![logo.png](/resources/logo.svg)

> 本项目 forked from [LeaVerou/dragula2](https://github.com/LeaVerou/dragula2)

中文文档：[Dragula 让拖放操作变简单的 JS 库](https://www.wenjiangs.com/article/dragula.html)

## 改动说明

支持拖入文件夹中

支持自动滚动 [PR #449](https://github.com/bevacqua/dragula/pull/449)

### `options.folderCss`

文件夹样式选择器，默认值：'[type=folder]'

### `drake.on` _(Events)_

The `drake` is an event emitter. The following events can be tracked using `drake.on(type, listener)`:

Event Name | Listener Arguments               | Event Description
-----------|----------------------------------|-------------------------------------------------------------------------------------
`drop`     | `el, target, source, sibling`    | `el` was dropped into `target` before a `sibling` element, and originally came from `source`

`drop` 事件增加 `_isHover` 参数，默认 `false`

如果是拖入文件夹中， `_isHover` 则为 `true`

示例：

```js
dragula([document.getElementById(left), document.getElementById(right)])
  .on('drop', (el, target, source, sibling, _isHover) => {
    if (_isHover) {
      // 拖入文件夹中
    } else {
      // 普通拖拽排序
    }
```

### `hover` 样式

`gu-drop-overlay`

## License

MIT
