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

let CSI, clrs, hide, csRe

// control sequence introducer
CSI = "\x1B["

function clr
(css) {
  return { norm: Decoration.mark({ attributes: { class: css } }),
           bold: Decoration.mark({ attributes: { class: css + '-bold' } }) }
}

clrs = []
clrs[1] = clr('cm-ansi-text')
clrs[32] = clr('cm-ansi-green')
clrs[36] = clr('cm-ansi-cyan')
d({clrs})

hide = Decoration.replace({})
// https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
//csRe = /\x1B\[32m/g
csRe = /\x1B\[[0-9]*m/gd

function stripeDeco(view) {
  let step = view.state.facet(stepSize)
  let builder = new RangeSetBuilder()
  for (let {from, to} of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      let line

      // printf '\033[36mcya \033[31mred \033[1mbold-red \033[36mcyan-still-bold\n'
      // cya red bold-red cyan-still-bold

      line = view.state.doc.lineAt(pos)

      if (0) {
        let match

        csRe.lastIndex = 0
        match = csRe.exec(line.text)
        if (match) {
          console.log({match})
          //builder.add(line.from + match.index, line.from + csRe.lastIndex, hide)
          builder.add(line.from + match.indices[0][0], line.from + match.indices[0][1], hide)
        }
      }

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
        let fg, bold, ranges

        function add
        (from, len /* of marker */, to, num) {
          // terminate previous
          if (fg && ranges.length) {
            let last
            last = ranges.at(-1)
            last.to = from
          }
          // weight change
          if ([1, 22].includes(num)) {
            if (num == 22) {
              // normal
              if (fg)
                ranges.push({ from: from + len, to: to, dec: clrs[fg].norm })
              bold = 0
            }
            if (num == 1) {
              // bold
              fg = fg || 1
              bold = 1
              ranges.push({ from: from + len, to: to, dec: clrs[fg].bold })
            }
            return
          }
          // color
          bold = 0
          if (num == 39)
            num = 0
          if (clrs[num]) {
            fg = num
            ranges.push({ from: from + len, to: to, dec: clrs[num].norm })
            return
          }
          fg = 0
        }

        ranges = []
        fg = 0
        bold = 0
        csRe.lastIndex = 0
        ;[...line.text.matchAll(csRe)].forEach(match => {
          let start, end, slice, num
          start = match.indices[0][0]
          end = match.indices[0][1]
          slice = line.text.slice(start + 2)
          num = parseInt(slice)
          console.log({num})
          if (0)
            // hide marker
            builder.add(line.from + start,
                        line.from + end,
                        hide)
          add(line.from + start, end - start, line.to, num)
        })
        d({ranges})
        ranges.forEach(r => builder.add(r.from, r.to, r.dec))
      }

      if (0)
        for (let i = 0; i < line.text.length; i++) {
          if (line.text.charCodeAt(i) == 27) { // ESC (\x1B)
            i++
            if (i >= line.text.length)
              break
            if (line.text.charCodeAt(i) == 91) { // [
              let num

              i++
              if (i >= line.text.length)
                break

              // control sequence
              num = parseInt(line.text.slice(i))
              if (isNaN(num))
                break
              // with a number
              if (clrs[num])
                builder.add(line.from + i, line.to, clrs[num].norm)
            }
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
