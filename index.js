let d = console.log

//!baseTheme

import {EditorView} from "@codemirror/view"

const baseTheme = EditorView.baseTheme({
  ".cm-ansi-text": {},
  ".cm-ansi-text-bold": { fontWeight: 'bold' },
  ".cm-ansi-green": { color: '#00AA00' },
  ".cm-ansi-cyan": { color: '#00AAAA' },
  ".cm-ansi-green-bold": { color: '#00AA00', fontWeight: 'bold' },
  ".cm-ansi-cyan-bold": { color: '#00AAAA', fontWeight: 'bold' }
})

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

let clrs, hide, csRe

function clr
(css) {
  return { norm: Decoration.mark({ attributes: { class: css } }),
           bold: Decoration.mark({ attributes: { class: css + '-bold' } }) }
}

clrs = []
clrs[1] = clr('cm-ansi-text')
clrs[32] = clr('cm-ansi-green')
clrs[36] = clr('cm-ansi-cyan')
//d({clrs})

hide = Decoration.replace({})
// https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
csRe = /\x1B\[[0-9]*m/gd

function stripeDeco(view) {
  let step, builder, cache
  step = view.state.facet(stepSize)
  builder = new RangeSetBuilder()
  cache = []
  for (let {from, to} of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      let line

      // printf '\033[36mcya \033[31mred \033[1mbold-red \033[36mcyan-still-bold\n'
      // cya red bold-red cyan-still-bold

      line = view.state.doc.lineAt(pos)

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
          let start, end, slice, num
          start = match.indices[0][0]
          end = match.indices[0][1]
          slice = line.text.slice(start + 2)
          num = parseInt(slice)
          console.log({num})
          add(line.from + start, end - start, line.to, num)
        })
        ranges.forEach(r => builder.add(r.from, r.to, r.dec))
        if (ranges.length) {
          cache[line.number] = ranges.filter(r => r.dec != hide).at(-1)
          //d('cached ' + line.number)
          //d('fg ' + ranges.at(-1).fg)
          //d('bold ' + ranges.at(-1).bold)
        }
      }

      pos = line.to + 1
    }
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
