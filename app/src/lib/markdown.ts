import showdown from 'showdown'
import DOMPurify from 'dompurify'

/**
 * Message markup rendering.
 *
 * Ported from the legacy client (`web/shared/markdown.ts` and the render pipeline in
 * `web/pages/Chat/components/Message.tsx`) so both frontends present a message the same
 * way. The order matters: markdown first, then quote wrapping over the resulting HTML,
 * then sanitisation last so nothing this module emits can be trusted by accident.
 */

const converter = new showdown.Converter()
converter.setOption('simpleLineBreaks', true)
converter.setOption('tables', true)

/**
 * Wraps double-quoted spans in `<q>`, and emphasis inside them in `<qem>`, so dialogue can
 * be coloured separately from narration -- the convention this app's themes are built on.
 */
function wrapWithQuoteElement(str: string) {
  // Normalise the various Unicode double quotes to the regular one first.
  str = str.replace(/[“”„‟]/g, '"')

  return str.replace(
    /*
     * <pre...</pre>   skip fenced code blocks whole
     * <code...</code> skip inline code whole
     * <[\s\S]*?>      skip any other HTML tag, so attribute values are not captured
     * (".+?")         capture quoted spans that are none of the above
     *
     * The code alternatives must come first, and must match markup rather than backticks:
     * this runs on Showdown's *output*, where fenced blocks are already `<pre><code>` and
     * inline code is `<code>`. The legacy client matched backticks here (` ``` `, `` ` ``),
     * which by this stage can never match -- so quotes inside code blocks were being
     * restyled as dialogue.
     */
    /<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[\s\S]*?>|(".+?")/gm,
    (match: string, quoted?: string) => {
      if (!quoted) return match
      const inner = quoted.replace(/<em>([\s\S]*?)<\/em>/gm, (m, emphasis?: string) =>
        emphasis ? `<qem>${emphasis.replace(/"/g, '')}</qem>` : m
      )
      return `<q>"${inner.replace(/"/g, '')}"</q>`
    }
  )
}

/**
 * Markdown -> sanitised HTML, safe to pass to `{@html}`.
 *
 * `qem` is not in DOMPurify's default allow-list, so it is added explicitly; every other
 * tag the pipeline emits is standard HTML that DOMPurify already permits.
 */
export function renderMarkdown(text: string): string {
  const html = converter
    .makeHtml(text)
    // Showdown replaces spaces in code blocks with `&nbsp;` but encodes the ampersand,
    // which renders literally as `&amp;nbsp;`. https://github.com/showdownjs/showdown/issues/669
    .replace(/&amp;nbsp;/g, '&nbsp;')

  return DOMPurify.sanitize(wrapWithQuoteElement(html), { ADD_TAGS: ['qem'] })
}
