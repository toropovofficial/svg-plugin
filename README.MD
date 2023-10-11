## Установка

```bash
# pnpm
pnpm viteplugin:build
```

## Использование

- Конфигурация vite.config.ts

```ts
import path from 'path'
import { createSvgIconsPlugin } from 'viteplugin'

export default () => {
  return {
    plugins: [
      createSvgIconsPlugin({
			iconDirs: [
				{
					key: 'product1',
					path: path.resolve(process.cwd(), 'src/assets/products/product1'),
				},
        {
					key: 'product2',
					path: path.resolve(process.cwd(), 'src/assets/products/product2'),
				},
				{
					key: 'base',
					path: path.resolve(process.cwd(), 'src/assets/products/base'),
				},
			],
			symbolId: '[dir]-[name]',
			customDomId: 'svg-collection',
			replaceStrokeWithCurrentColor: false,
			outDir: path.resolve(__dirname, 'src/assets/sprites'),
		}),
    ],
  }
}

```

## Как использовать в компонентах

- В режиме dev

```ts
import 'virtual:svg-icons-base'
import 'virtual:svg-icons-product1'
import 'virtual:svg-icons-product2'
```

- В режиме build

```ts
const encodeSvg = await import(`../src/assets/sprites/${product}.svg`)
const decodedSvg = atob(encodeSvg.default.split(',')[1])
const svgElement = new DOMParser().parseFromString(decodedSvg, 'image/svg+xml').firstChild
document.body.appendChild(svgElement)
```

- В режиме build или когда передан параметр isBuild

```vue
<svg v-if="props.sprite">
  <use :xlink:href="`/${product}.svg#${svgName}-${product}`" />
</svg>
```

### Дополнительные параметры

- **isBuild** - Свойство, которе заставляет работать плагин в режиме build, но с ограничениями. В этом случае плагин не проходит по всем модулям, а один раз генерирует нужные спрайты. Динамические и виртуальные импорты для получения svg использовать нельзя.

- **replaceStrokeWithCurrentColor** - Свойство, которое разрешает или запрещает заменять у svg currentColor

- **outDir** - Свойство указывающее директорию, в которую будут генерироваться спрайты