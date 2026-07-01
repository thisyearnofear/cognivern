import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Architecture' button to reveal the product architecture and integration guidance sections on the landing page.
        # Architecture button
        elem = page.get_by_role('button', name='Architecture', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify product architecture information is displayed
        # Assert: The page shows the 'Architecture' heading.
        await expect(page.locator("xpath=/html/body/div[1]/div[5]/div/main/turbo-frame/div/react-app/div/div[2]/div[1]/div/div/div[2]/div/div/div[2]/div[4]/div/div[3]/section/div[1]/article/div[1]/h1").nth(0)).to_have_text("Architecture", timeout=15000), "The page shows the 'Architecture' heading."
        # Assert: The document includes integration guidance such as 'SigningProvider.dispatch()' showing connections to external providers.
        await expect(page.locator("xpath=/html/body/div[1]/div[5]/div/main/turbo-frame/div/react-app/div/div[2]/div[1]/div/div/div[2]/div/div/div[2]/div[4]/div/div[3]/section/div[1]/article/div[5]/pre").nth(0)).to_contain_text("SigningProvider.dispatch()", timeout=15000), "The document includes integration guidance such as 'SigningProvider.dispatch()' showing connections to external providers."
        
        # --> Verify integration guidance is displayed
        # Assert: Integration guidance lists SigningProvider.dispatch and supported providers (Ledger, Speculos, Local, OWS Remote).
        await expect(page.locator("xpath=/html/body/div[1]/div[5]/div/main/turbo-frame/div/react-app/div/div[2]/div[1]/div/div/div[2]/div/div/div[2]/div[4]/div/div[3]/section/div[1]/article/div[5]/div/clipboard-copy").nth(0)).to_contain_text("SigningProvider.dispatch()  \u2190 Ledger / Speculos / Local / OWS Remote", timeout=15000), "Integration guidance lists SigningProvider.dispatch and supported providers (Ledger, Speculos, Local, OWS Remote)."
        # Assert: Integration guidance references Filecoin evidence anchoring via FilecoinStorageService.
        await expect(page.locator("xpath=/html/body/div[1]/div[5]/div/main/turbo-frame/div/react-app/div/div[2]/div[1]/div/div/div[2]/div/div/div[2]/div[4]/div/div[3]/section/div[1]/article/div[5]/div/clipboard-copy").nth(0)).to_contain_text("FilecoinStorageService", timeout=15000), "Integration guidance references Filecoin evidence anchoring via FilecoinStorageService."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    