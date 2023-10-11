import { resolve } from 'path'
import type { Plugin } from 'vite'
import type { OptimizedSvg } from 'svgo'
import fg from 'fast-glob'
// eslint-disable-next-line import/default
import fs from 'fs-extra'
import path from 'pathe'
import SVGCompiler from 'svg-baker'
import { optimize } from 'svgo'
import { normalizePath } from 'vite'
import type { ViteSvgIconsPlugin, FileStats, DomInject, IModule, IOptons, ISymbolOptions } from './types'
import { SVG_DOM_ID, XMLNS, XMLNS_LINK } from './const'

export function createSvgIconsPlugin(opt: ViteSvgIconsPlugin): Plugin {
	const cache = new Map<string, FileStats>()

	let isBuild = false
	let count = 1
	const options = {
		svgoOptions: true,
		symbolId: 'icon-[dir]-[name]',
		inject: 'body-last' as const,
		customDomId: SVG_DOM_ID,
		replaceStrokeWithCurrentColor: true,
		...opt,
	}

	let { svgoOptions } = options

	const { symbolId } = options

	if (!symbolId.includes('[name]')) {
		throw new Error('SymbolId must contain [name] string!')
	}

	if (svgoOptions) {
		svgoOptions = typeof svgoOptions === 'boolean' ? {} : svgoOptions
	}

	return {
		name: 'vite:svg-icons',
		configResolved(resolvedConfig) {
			isBuild = options.isBuild ? options.isBuild : resolvedConfig.command === 'build'
		},
		resolveId(id) {
			if (id.includes('virtual')) {
				return id
			}

			return null
		},
		async load(id, ssr) {
			if (!isBuild && !ssr) return null

			if (count === 0) return
			if (options.isBuild) --count

			let html: string | null = null

			const { iconDirs, outDir } = options

			if (options.isBuild) await resetOutDir(outDir)

			if (Array.isArray(iconDirs)) {
				for (const item of iconDirs) {
					html = await createSvg({
						cache,
						svgoOptions,
						options,
						iconDir: item,
						isBuild,
						outDir,
						id,
						self: this,
					})

					if (html && !isBuild) {
						return html
					}
				}
			} else {
				html = await createSvg({
					cache,
					svgoOptions,
					options,
					iconDir: iconDirs,
					isBuild,
					outDir,
					id,
					self: this,
				})

				if (html && !isBuild) {
					return html
				}
			}

			return null
		},
	}
}

async function resetOutDir(dirPath: string) {
	try {
		const items = await fs.readdir(dirPath)

		const files = items.map(async (item) => {
			const fileOrFolder = await fs.lstat(`${dirPath}/${item}`)
			const isFile = fileOrFolder.isFile()
			return isFile ? fs.unlink(path.join(dirPath, item)) : false
		})

		await Promise.all(files)
	} catch (err) {
		console.log(err)
	}
}

export async function createSvg(item: IOptons) {
	const icons = await compilerIcons(item)
	const module = createModuleCode({ ...item, insertHtml: icons })

	if (item.isBuild || item.options.isBuild) {
		createSvgFile(module, item.outDir, item.self)
	} else if (item.id.includes(module.product)) {
		return module.code
	}

	return null
}

export function createSvgFile(module: IModule, outDir: string, self: any) {
	if (!outDir) {
		self.emitFile({
			type: 'asset',
			fileName: `${module.product}.svg`,
			source: module.code,
		})

		return
	}

	const dir = resolve(outDir)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir)
	}

	const fileOutPath = resolve(dir, `${module.product}.svg`)
	fs.writeFileSync(fileOutPath, module.code)
}

export async function compilerIcons(item: IOptons) {
	let insertHtml = ''
	const idSet = new Set<string>()
	const svgFilsStats = fg.sync('**/*.svg', {
		cwd: item.iconDir.path,
		stats: true,
		absolute: true,
	})

	for (const entry of svgFilsStats) {
		const { path, stats: { mtimeMs } = {} } = entry
		const cacheStat = item.cache.get(path)
		let svgSymbol
		let symbolId
		let relativeName = ''

		const getSymbol = async () => {
			relativeName = normalizePath(path).replace(normalizePath(item.iconDir.path + '/'), '')

			symbolId = createSymbolId(relativeName, item.options)

			svgSymbol = await compilerIcon({ ...item, filePath: path, symbolId })
			idSet.add(symbolId)
		}

		if (cacheStat) {
			if (cacheStat.mtimeMs !== mtimeMs) {
				await getSymbol()
			} else {
				svgSymbol = cacheStat.code
				symbolId = cacheStat.symbolId
				symbolId && idSet.add(symbolId)
			}
		} else {
			await getSymbol()
		}

		svgSymbol &&
			item.cache.set(path, {
				mtimeMs,
				relativeName,
				code: svgSymbol,
				symbolId,
			})
		insertHtml += `${svgSymbol || ''}`
	}

	return insertHtml
}

export function createModuleCode(item: IOptons) {
	const key = item.iconDir?.key || ''
	const xmlns = `xmlns="${XMLNS}"`
	const xmlnsLink = `xmlns:xlink="${XMLNS_LINK}"`
	let html = ''

	if (item.insertHtml) {
		html = item.insertHtml.replace(new RegExp(xmlns, 'g'), '').replace(new RegExp(xmlnsLink, 'g'), '')
	}

	const code = !item.isBuild
		? `
       if (typeof window !== 'undefined') {
         function loadSvg() {
           var body = document.body;
           var svgDom = document.getElementById('${item.options.customDomId + key}');
           if(!svgDom) {
             svgDom = document.createElementNS('${XMLNS}', 'svg');
             svgDom.style.position = 'absolute';
             svgDom.style.width = '0';
             svgDom.style.height = '0';
             svgDom.id = '${item.options.customDomId}-${key}';
             svgDom.setAttribute('xmlns','${XMLNS}');
             svgDom.setAttribute('xmlns:link','${XMLNS_LINK}');
           }
           svgDom.innerHTML = ${JSON.stringify(html)};
           ${domInject(item.options.inject)}
         }
         if(document.readyState === 'loading') {
           document.addEventListener('DOMContentLoaded', loadSvg);
         } else {
           loadSvg()
         }
      }
        `
		: `<svg id="svg-collection" xmlns="http://www.w3.org/2000/svg" style="position: absolute; width: 0px; height: 0px;">${html}</svg>`
	return {
		product: key,
		code: !item.isBuild ? `${code}\nexport default {}` : code,
	}
}

function domInject(inject: DomInject = 'body-last') {
	switch (inject) {
		case 'body-first':
			return 'body.insertBefore(svgDom, body.firstChild);'
		default:
			return 'body.insertBefore(svgDom, body.lastChild);'
	}
}

/**
 * Preload all icons in advance
 * @param cache
 * @param options
 */

export async function compilerIcon(item: ISymbolOptions): Promise<string | null> {
	if (!item.filePath) {
		return null
	}

	let content = fs.readFileSync(item.filePath, 'utf-8')

	if (item.svgoOptions) {
		const { data } = optimize(content, item.svgoOptions) as OptimizedSvg
		content = data || content
	}

	if (item.options.replaceStrokeWithCurrentColor) {
		content = content.replace(/stroke="[a-zA-Z#0-9]*"/, 'stroke="currentColor"')
	}

	const svgSymbol = await new SVGCompiler().addSymbol({
		id: item.symbolId + '-' + item.iconDir.key,
		content,
		path: item.filePath,
	})

	return svgSymbol.render()
}

export function createSymbolId(name: string, options: ViteSvgIconsPlugin) {
	const { symbolId } = options

	if (!symbolId) {
		return name
	}

	let id = symbolId
	let fName = name

	const { fileName = '', dirName } = discreteDir(name)

	if (symbolId.includes('[dir]')) {
		id = id.replace(/\[dir\]/g, dirName)

		if (!dirName) {
			id = id.replace('-', '')
		}
		fName = fileName
	}

	id = id.replace(/\[name\]/g, fName)
	return id.replace(path.extname(id), '')
}

export function discreteDir(name: string) {
	if (!normalizePath(name).includes('/')) {
		return {
			fileName: name,
			dirName: '',
		}
	}
	const strList = name.split('/')
	const fileName = strList.pop()
	const dirName = strList.join('-')

	return { fileName, dirName }
}
