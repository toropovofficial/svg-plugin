import type { OptimizeOptions } from 'svgo'

export type DomInject = 'body-first' | 'body-last'

export interface IIconDir {
	key: string
	path: string
}

export interface IModule {
	product: string
	code: string
}

export interface ViteSvgIconsPlugin {
	/**
	 * icons folder, all svg files in it will be converted to svg sprite.
	 */
	iconDirs: IIconDir[]

	/**
	 * svgo configuration, used to compress svg
	 * @default：true
	 */
	svgoOptions?: boolean | OptimizeOptions

	/**
	 * icon format
	 * @default: icon-[dir]-[name]
	 */
	symbolId?: string

	/**
	 * icon format
	 * @default: body-last
	 */
	inject?: DomInject

	/**
	 * custom dom id
	 * @default: __svg__icons__dom__
	 */
	customDomId?: string

	/**
	 * option to perform a replacement of stroke colors with currentColor
	 * @default：true
	 */
	replaceStrokeWithCurrentColor?: boolean

	outDir: string

	isBuild?: boolean
}

export interface FileStats {
	relativeName: string
	mtimeMs?: number
	code: string
	symbolId?: string
}
export interface IOptons {
	cache: Map<string, FileStats>
	svgoOptions: OptimizeOptions | {}
	options: ViteSvgIconsPlugin
	iconDir: IIconDir
	isBuild: boolean
	outDir: string
	id: string
	self: any
	insertHtml?: string
}

export interface ISymbolOptions extends IOptons {
	filePath: string
	symbolId: string
}
