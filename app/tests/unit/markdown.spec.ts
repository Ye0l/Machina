import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '/app/lib/markdown'

describe('renderMarkdown', () => {
  it('renders standard markdown', () => {
    const html = renderMarkdown('Some **bold** and *italic* and `code`.')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code>code</code>')
  })

  it('renders lists and links', () => {
    const html = renderMarkdown('- one\n- two\n\n[label](https://example.com)')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('href="https://example.com"')
  })

  it('treats single newlines as line breaks', () => {
    expect(renderMarkdown('one\ntwo')).toContain('<br')
  })

  describe('quote wrapping', () => {
    it('wraps quoted dialogue in <q>', () => {
      expect(renderMarkdown('"Hello there."')).toContain('<q>"Hello there."</q>')
    })

    it('promotes emphasis inside a quote to <qem>', () => {
      const html = renderMarkdown('"A line with *emphasis* inside."')
      expect(html).toContain('<qem>emphasis</qem>')
      // The <em> must have been replaced, not merely wrapped.
      expect(html).not.toContain('<em>emphasis</em>')
    })

    it('leaves emphasis outside a quote as <em>', () => {
      const html = renderMarkdown('Narration with *emphasis*.')
      expect(html).toContain('<em>emphasis</em>')
      expect(html).not.toContain('<qem>')
    })

    it('normalises unicode double quotes', () => {
      expect(renderMarkdown('“Hello.”')).toContain('<q>"Hello."</q>')
    })

    it('does not touch quotes inside inline code', () => {
      const html = renderMarkdown('`const a = "b"`')
      expect(html).not.toContain('<q>')
    })

    it('does not touch quotes inside a fenced code block', () => {
      const html = renderMarkdown('```\nsay "hello"\n```')
      expect(html).not.toContain('<q>')
    })

    it('does not treat an HTML attribute value as dialogue', () => {
      // The tag itself is stripped by the sanitiser, but the quote wrapper runs first and
      // must not have turned its attribute into a <q>.
      expect(renderMarkdown('<a href="https://example.com">x</a>')).not.toContain('<q>')
    })
  })

  describe('sanitising', () => {
    it('strips script tags', () => {
      const html = renderMarkdown('before <script>window.x = 1</script> after')
      expect(html).not.toContain('<script')
      expect(html).not.toContain('window.x = 1')
    })

    it('strips inline event handlers', () => {
      const html = renderMarkdown('<img src=x onerror="window.x = 1">')
      expect(html).not.toContain('onerror')
    })

    it('strips javascript: urls', () => {
      expect(renderMarkdown('[click](javascript:alert(1))')).not.toContain('javascript:')
    })

    it('keeps the qem tag it introduces itself', () => {
      expect(renderMarkdown('"with *emphasis*"')).toContain('<qem>')
    })
  })

  it('does not leak the showdown &amp;nbsp; bug into code blocks', () => {
    expect(renderMarkdown('```\n  indented\n```')).not.toContain('&amp;nbsp;')
  })

  it('returns empty output for empty input', () => {
    expect(renderMarkdown('').trim()).toBe('')
  })
})
