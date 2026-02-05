from playwright.sync_api import sync_playwright, expect
import os

def verify_allied_health():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 2000})

        page.goto("http://localhost:3000/login")
        page.wait_for_timeout(2000)

        page.fill('input[type="email"]', 'admin@fiddlerscheduler.com')
        page.fill('input[type="password"]', 'password')
        page.click('button:has-text("Sign In")')
        page.wait_for_timeout(3000)

        page.click('button:has-text("View Schedule")')
        page.wait_for_timeout(1000)

        page.fill('input[type="date"]', "2024-05-20")
        page.wait_for_timeout(2000)

        page.click('button:has-text("Generate Schedule")')
        page.wait_for_timeout(5000)

        page.evaluate("window.scrollTo(0, 500)")

        os.makedirs("verification", exist_ok=True)
        path = "verification/final_verification.png"
        page.screenshot(path=path)
        print(f"Saved {path}")

        browser.close()

if __name__ == "__main__":
    verify_allied_health()
