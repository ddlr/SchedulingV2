import asyncio
from playwright.async_api import async_playwright

async def verify_fix():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Navigate to login page
        print("Navigating to http://localhost:3000/login ...")
        await page.goto("http://localhost:3000/login")
        await page.wait_for_timeout(2000)

        # Login
        print("Attempting login...")
        await page.fill('input[type="email"]', 'admin@fiddlerscheduler.com')
        await page.fill('input[type="password"]', 'password')
        await page.click('button:has-text("Sign In")')
        await page.wait_for_timeout(3000)

        print(f"Current URL: {page.url}")

        # Check if dashboard loaded
        if "/app" in page.url or await page.query_selector('text="Fiddler Scheduler"'):
            print("Successfully reached dashboard!")
            # Check if "Sample Client (Dev)" is visible
            if await page.query_selector('text="Sample Client (Dev)"'):
                print("Sample Client is visible!")
                await page.screenshot(path="verification/dashboard_fixed.png")
            else:
                print("Sample Client NOT found, but page loaded.")
                await page.screenshot(path="verification/dashboard_loaded_no_client.png")
        else:
            print("Failed to reach dashboard.")
            await page.screenshot(path="verification/fix_failure.png")

        await browser.close()

if __name__ == "__main__":
    import os
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(verify_fix())
