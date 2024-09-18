let d, clrs, style

d = console.log

//!baseTheme

import {EditorView} from "@codemirror/view"

function bgDec
(bg, bold) {
  let fg, c
  fg = bg - 10
  c = clrs[fg]
  return bold ? c.boldBg : c.bg
}

function isBg
(num) {
  return (num >= 40) && (num <= 47)
}

function isClr
(num) {
  return isBg(num) || clrs[num]
}

function clr
(name, color) {
  let css
  css = 'cm-ansi-' + name
  if (color) {
    style['.' + css] = { color: color }
    style['.' + css + '-bg'] = { backgroundColor: color }
  }
  else {
    // special case for regular fg with bold (eg ESC[1m or ESC[1;40m)
    style['.' + css] = {}
    style['.' + css + '-bg'] = {}
  }
  return { norm: Decoration.mark({ attributes: { class: css } }),
           bg: Decoration.mark({ attributes: { class: css + '-bg' } }),
           bold: Decoration.mark({ attributes: { class: css + ' cm-ansi-bold' } }),
           boldBg: Decoration.mark({ attributes: { class: css + '-bg cm-ansi-bold' } }) }
}

style = { '.cm-ansi-bold': { fontWeight: 'bold' } }
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
  let fg, bg, bold, ranges, hit, matches

  function boldOn
  () {
    d('bold on')
    bold = 1
  }

  function boldOff
  () {
    d('bold off')
    bold = 0
  }

  function push
  (attr) {
    d({attr})
    if (attr.from == undefined)
      // pushing for the line cache, eg for reset
      attr.skipStyle = 1
    else if (attr.hide) {
      // this "attribute" hides the control sequences
      attr.dec = hide
      // cache is for attributes that affect the style
      attr.skipCache = 1
    }
    else if (attr.bg)
      attr.dec = bgDec(attr.bg, attr.bold)
    else if (attr.fg)
      attr.dec = attr.bold ? clrs[attr.fg].bold : clrs[attr.fg].norm
    else if (attr.bold)
      attr.dec = clrs[1].bold
    ranges.push(attr)
  }

  function add
  (from, len /* of marker */, to, num) {
    // terminate previous
    if ((fg || bg || bold) && ranges.length) {
      let last
      last = ranges.at(-1)
      last.to = from
    }
    // hide control sequence
    if (1)
      push({ from: from, to: from + len, hide: 1 })
    // reset
    if (num == 0) {
      fg = 0
      bg = 0
      push({ bold: 0, fg: fg, bg: bg }) // dummy, for cache
      boldOff()
      return
    }
    // weight change
    if ([1, 22].includes(num)) {
      if (num == 22) {
        // normal
        boldOff()
        if (fg || bg)
          push({ from: from + len, to: to, fg: fg, bg: bg, bold: 0 })
      }
      if (num == 1) {
        // bold
        boldOn()
        push({ from: from + len, to: to, fg: fg, bg: bg, bold: 1 })
      }
      return
    }
    // color
    if (num == 39) {
      num = 0
      boldOff()
    }
    if (isClr(num)) {
      if (isBg(num))
        bg = num
      else
        fg = num
      push({ from: from + len, to: to, fg: fg, bg: bg, bold: bold })
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
    d('hit ' + line.number)
    d('fg ' + hit.fg)
    d('bg ' + hit.bg)
    d('bold ' + hit.bold)
  }
  fg = hit?.fg || 0
  bg = hit?.bg || 0
  bold = hit?.bold || 0
  csRe.lastIndex = 0
  matches = line.text.matchAll(csRe)
  matches.forEach(match => {
    let start, end
    start = match.indices[0][0]
    end = match.indices[0][1]
    // First attribute has own group
    addGroup(line, start, end, match.indices[1])
    // Remaining attributes need to be split
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
  ranges.forEach(r => r.skipStyle || builder.add(r.from, r.to, r.dec))
  if (ranges.length) {
    cache[line.number] = ranges.filter(r => r.skipCache).at(-1)
    d('cached ' + line.number)
    d('fg ' + cache[line.number].fg)
    d('bg ' + cache[line.number].bg)
    d('bold ' + cache[line.number].bold)
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
