"""Browser regression tests. Optional tooling: pip install playwright;
python -m playwright install chromium; python tests/browser_test.py.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={"width": 1200, "height": 800}, offline=True)
    page = context.new_page()
    errors, remote_requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: remote_requests.append(request.url) if request.url.startswith('http') else None)
    page.goto((ROOT / 'index.html').as_uri())
    editor = page.locator('#ed')

    def fill(text, caret=None):
        editor.fill(text)
        editor.focus()
        if caret is not None:
            editor.evaluate('(el, pos) => el.setSelectionRange(pos, pos)', caret)
        page.wait_for_function("""() => {
          const el = document.querySelector('#ed');
          const expected = calcDebug.suggest(el.value.slice(0, el.selectionStart));
          const chips = [...document.querySelectorAll('.chip')];
          return expected.length > 0 && chips.length === expected.length &&
            chips.every((chip, i) => chip.querySelector('.ins').textContent === expected[i].ins);
        }""")

    fill('2c to k =')
    expect(page.locator('.ghost')).to_have_text(' 275.15k')
    page.keyboard.press('Tab')
    expect(editor).to_have_value('2c to k = 275.15k')
    print('PASS: visible inline Kelvin result and Tab acceptance')

    for expr, result in [('1 atm to torr =', ' 760 torr'), ('1 inHg to mmHg =', ' 25.4 mmHg')]:
        fill(expr)
        expect(page.locator('.ghost')).to_have_text(result)
        page.keyboard.press('Tab')
        expect(editor).to_have_value(expr + result)
    print('PASS: pressure conversions render and accept')

    fill('2c to k =')
    page.keyboard.press('Enter')
    expect(editor).to_have_value('2c to k =\n')
    print('PASS: Enter inserts a newline, not a suggestion')

    fill('1/3 =')
    caret = editor.evaluate('el => el.selectionStart')
    page.keyboard.press('ArrowRight')
    expect(page.locator('.chip.active')).to_have_attribute('data-i', '1')
    assert editor.evaluate('el => el.selectionStart') == caret
    page.keyboard.press('ArrowLeft')
    expect(page.locator('.chip.active')).to_have_attribute('data-i', '0')
    assert editor.evaluate('el => el.selectionStart') == caret
    print('PASS: left/right switch suggestions without moving the caret')

    page.evaluate("window.addEventListener('keydown', e => { window.lastKey = {key:e.key, prevented:e.defaultPrevented}; });")
    text = 'previous line\n1/3 =\nnext line'
    caret = len('previous line\n1/3 =')
    fill(text, caret)
    page.keyboard.press('ArrowRight')
    expect(page.locator('.chip.active')).to_have_attribute('data-i', '1')
    page.keyboard.press('ArrowUp')
    assert page.evaluate('window.lastKey') == {'key': 'ArrowUp', 'prevented': False}
    assert editor.evaluate('el => el.selectionStart') < caret
    fill(text, caret)
    page.keyboard.press('ArrowDown')
    assert page.evaluate('window.lastKey') == {'key': 'ArrowDown', 'prevented': False}
    assert editor.evaluate('el => el.selectionStart') > caret
    print('PASS: up/down use native cursor movement even with suggestions available')

    fill('1 atm to torr =')
    page.keyboard.press('Escape')
    expect(page.locator('.chip')).to_have_count(0)
    expect(page.locator('.ghost')).to_have_count(0)
    fill('1 atm to torr =')
    page.keyboard.press('Alt+1')
    expect(editor).to_have_value('1 atm to torr = 760 torr')
    fill('1 atm to torr =')
    page.locator('.chip').first.click()
    expect(editor).to_have_value('1 atm to torr = 760 torr')
    print('PASS: Escape, Alt+number, and click retained')

    page.wait_for_function("localStorage.getItem('calc-notes-v1') === '1 atm to torr = 760 torr'")
    page.reload()
    expect(editor).to_have_value('1 atm to torr = 760 torr')
    print('PASS: local note persistence')

    page.set_viewport_size({'width': 390, 'height': 844})
    page.emulate_media(color_scheme='dark')
    fill('2c to k =')
    expect(page.locator('.ghost')).to_have_text(' 275.15k')
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    assert page.locator('#bar').bounding_box()['width'] == 390
    print('PASS: mobile viewport and dark theme')

    # The Arena file viewer runs scripts in an opaque-origin, networkless iframe.
    # Verify calculations still work when localStorage is unavailable there.
    page.set_content('<iframe sandbox="allow-scripts" style="width:100%;height:600px"></iframe>')
    page.locator('iframe').evaluate('(el, html) => el.srcdoc = html', (ROOT / 'index.html').read_text())
    frame = page.frame_locator('iframe')
    frame.locator('#ed').fill('2c to k =')
    expect(frame.locator('.ghost')).to_have_text(' 275.15k')
    print('PASS: sandboxed file preview without storage access')

    assert not errors, errors
    assert not remote_requests, remote_requests
    print('PASS: no JavaScript errors; no network dependencies')
    browser.close()
