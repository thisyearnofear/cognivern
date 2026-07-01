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
        
        # -> Navigate to the '/os' page (open the OS/terminal application page).
        await page.goto("http://localhost:3000/os")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'show me active agents' starter prompt button to run a command in the terminal.
        # show me active agents button
        elem = page.locator('xpath=/html/body/div[2]/div/main/main/div/div/div/div/div[2]/div/div[2]/button')
        await elem.click(timeout=10000)
        
        # -> Click the 'hydra help' starter prompt and observe terminal output to verify a response and that the prompt remains interactive.
        # hydra help button
        elem = page.get_by_text('Starter prompts', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='hydra help', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify terminal output is displayed
        # Assert: Terminal displays the output 'Error: Failed to reach intent service'.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/div[2]/div[1]/div/div/div[2]/div[1]").nth(0)).to_contain_text("Error: Failed to reach intent service", timeout=15000), "Terminal displays the output 'Error: Failed to reach intent service'."
        
        # --> Verify the prompt remains interactive
        # Assert: The terminal status shows 'ready', indicating the prompt is interactive.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/main/div/div/footer/div/span[1]").nth(0)).to_have_text("ready", timeout=15000), "The terminal status shows 'ready', indicating the prompt is interactive."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    