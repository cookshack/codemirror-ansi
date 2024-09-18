let d, clrs, style

d = console.log

//!baseTheme

import {EditorView} from "@codemirror/view"

function clr
(name, color) {
  let css
  css = 'cm-ansi-' + name
  if (color) {
    style['.' + css] = { color: color }
    style['.' + css + '-bold'] = { color: color, fontWeight: 'bold' }
  }
  else {
    // special case for plain bold (num 1)
    style[css] = {}
    style[css + '-bold'] = { fontWeight: 'bold' }
  }
  return { norm: Decoration.mark({ attributes: { class: css } }),
           bold: Decoration.mark({ attributes: { class: css + '-bold' } }) }
}

style = {}
clrs = []
clrs[1] = clr('text', null)
clrs[30] = clr('black', '#000000')
clrs[31] = clr('red', '#AA0000')
clrs[32] = clr('green', '#00AA00')
clrs[33] = clr('yellow', '#AA5500')
clrs[34] = clr('blue', '#0000AA')
clrs[35] = clr('magenta', '#AA00AA')
clrs[36] = clr('cyan', '#00AAAA')
clrs[37] = clr('white', '#AAAAAA')

const baseTheme = EditorView.baseTheme(style)

//!facet

import {Facet} from "@codemirror/state"

const stepSize = Facet.define({
  combine: values => values.length ? Math.min(...values) : 2
})

//!constructor

export function ansi(options = {}) {
  return [
    baseTheme,
    options.step == null ? [] : stepSize.of(options.step),
    showStripes
  ]
}

//!stripeDeco

import {Decoration} from "@codemirror/view"
import {RangeSetBuilder} from "@codemirror/state"

let hide, csRe

hide = Decoration.replace({})
// Select Graphic Rendition
// https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
// ESC[m
// ESC[1m
// ESC[1;32m
// ESC[1;32;43m
csRe = /\x1B\[([0-9]*)((?:;[0-9]+)*)m/gd  // (?: ) is non capturing group

function decoLine
(builder, cache, line) {
  // printf '\033[36mcya \033[31mred \033[1mbold-red \033[36mcyan-still-bold\n'
  // cya red bold-red cyan-still-bold

  if (0) {
    // just hide
    csRe.lastIndex = 0
      ;[...line.text.matchAll(csRe)].forEach(match => {
      console.log({match})
      builder.add(line.from + match.indices[0][0],
                  line.from + match.indices[0][1],
                  hide)
    })
  }

  if (1) {
    let fg, bold, ranges, hit

    function add
    (from, len /* of marker */, to, num) {
      // terminate previous
      if (fg && ranges.length) {
        let last
        last = ranges.at(-1)
        last.to = from
      }
      // hide control sequence
      if (1)
        ranges.push({ from: from,
                     to: from + len,
                     dec: hide })
      // weight change
      if ([1, 22].includes(num)) {
        if (num == 22) {
          // normal
          bold = 0
          if (fg)
            ranges.push({ from: from + len, to: to, dec: clrs[fg].norm, fg: fg, bold: 0 })
        }
        if (num == 1) {
          // bold
          fg = fg || 1
          bold = 1
          ranges.push({ from: from + len, to: to, dec: clrs[fg].bold, fg: fg, bold: 1 })
        }
        return
      }
      // color
      bold = 0
      if (num == 39)
        num = 0
      if (clrs[num]) {
        fg = num
        ranges.push({ from: from + len, to: to, dec: clrs[num].norm, fg: fg, bold: 0 })
        return
      }
      fg = 0
    }

    function addAttr
    (line, start, end, slice) {
      let num
      num = parseInt(slice)
      console.log({num})
      add(line.from + start, end - start, line.to, num)
    }

    function addGroup
    (line, start, end, group) {
      let slice, num
      if (group[0] == group[1])
        // should only happen for first group, via ESC[m;
        num = 0
      else {
        slice = line.text.slice(group[0])
        num = parseInt(slice)
      }
      console.log({num})
      add(line.from + start, end - start, line.to, num)
    }

    ranges = []
    if (line.number > 0)
      hit = cache[line.number - 1]
    if (hit) {
      //d('hit ' + line.number)
      //d('fg ' + hit.fg)
      //d('bold ' + hit.bold)
    }
    fg = hit?.fg || 0
    bold = hit?.bold || 0
    csRe.lastIndex = 0
      ;[...line.text.matchAll(csRe)].forEach(match => {
      let start, end
      start = match.indices[0][0]
      end = match.indices[0][1]
      addGroup(line, start, end, match.indices[1])
      if (match.indices.length > 2) {
        let group2
        group2 = match.indices[2]
        if (group2[0] == group2[1])
          return
        line.text.slice(group2[0], group2[1]).split(';').forEach(attr => {
          if (attr.length)
            addAttr(line, start, end, attr)
        })
      }
    })
    ranges.forEach(r => builder.add(r.from, r.to, r.dec))
    if (ranges.length) {
      cache[line.number] = ranges.filter(r => r.dec != hide).at(-1)
      //d('cached ' + line.number)
      //d('fg ' + ranges.at(-1).fg)
      //d('bold ' + ranges.at(-1).bold)
    }
  }
}

function stripeDeco(view) {
  let step, builder, cache
  step = view.state.facet(stepSize)
  builder = new RangeSetBuilder()
  cache = []
  for (let {from, to} of view.visibleRanges)
    for (let pos = from; pos <= to;) {
      let line
      line = view.state.doc.lineAt(pos)
      decoLine(builder, cache, line)
      pos = line.to + 1
    }
  return builder.finish()
}

//!showStripes

import {ViewPlugin} from "@codemirror/view"

const showStripes = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = stripeDeco(view)
  }

  update(update) {
    if (update.docChanged || update.viewportChanged)
      this.decorations = stripeDeco(update.view)
  }
}, {
  decorations: v => v.decorations
})
