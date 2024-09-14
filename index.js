//!baseTheme

import {EditorView} from "@codemirror/view"

const baseTheme = EditorView.baseTheme({
  "&light .cm-ansi": {backgroundColor: "#d4fafa"},
  "&dark .cm-ansi": {backgroundColor: "#1a2727"},
  ".cm-ansi-green": { color: '#00AA00' },
  ".cm-ansi-cyan": { color: '#00AAAA' }
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

const stripeL = Decoration.line({
  attributes: {class: "cm-ansi"}
})

const stripe = Decoration.mark({ attributes: { class: "cm-ansi" } })

clrs = []
clrs[32] = Decoration.mark({ attributes: { class: "cm-ansi-green" } })
clrs[36] = Decoration.mark({ attributes: { class: "cm-ansi-cyan" } })

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

      if (1) {
        csRe.lastIndex = 0
        ;[...line.text.matchAll(csRe)].forEach(match => {
          console.log({match})
          builder.add(line.from + match.indices[0][0],
                      line.from + match.indices[0][1],
                      hide)
        })
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
                builder.add(line.from + i, line.to, clrs[num])
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
