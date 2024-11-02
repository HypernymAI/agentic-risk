const { chromium } = require('playwright');
const { JSDOM } = require('jsdom');

async function extractCleanWebsiteInfo(websiteOrBrand) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        // Get main website from Google search
        const mainSearchQuery = encodeURIComponent(websiteOrBrand);
        await page.goto(`https://www.google.com/search?q=${mainSearchQuery}`);
        
        const firstResult = await page.waitForSelector('div.g a', { timeout: 5000 });
        const mainWebsiteUrl = await firstResult.getAttribute('href');
        
        // Visit main website
        await page.goto(mainWebsiteUrl);
        
        // Extract only specified metadata
        const mainMetadata = await page.evaluate(() => {
            const getMetaContent = (name) => {
                const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
                return meta ? meta.getAttribute('content') : null;
            };

            return {
                title: document.title || null,
                description: getMetaContent('description') || getMetaContent('og:description') || null,
                keywords: getMetaContent('keywords') || null,
                author: getMetaContent('author') || null
            };
        });

        // Get Terms of Service content
        const tosSearchQuery = encodeURIComponent(`${websiteOrBrand} terms of service OR terms and conditions`);
        await page.goto(`https://www.google.com/search?q=${tosSearchQuery}`);
        
        const tosResult = await page.waitForSelector('div.g a', { timeout: 5000 });
        const tosUrl = await tosResult.getAttribute('href');
        
        // Visit ToS page
        await page.goto(tosUrl);
        
        // Get ToS content and clean it
        const tosContent = await page.evaluate(() => {
            // Get the body content
            const content = document.body.innerText || document.body.textContent;
            
            // Remove extra whitespace and normalize spaces
            return content
                .replace(/\s+/g, ' ')
                .replace(/[\r\n]+/g, '\n')
                .trim();
        });

        // Further clean the text by removing quotes and normalizing whitespace
        const cleanText = tosContent
            .replace(/['"]/g, '') // Remove all quotes
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/\n\s+/g, '\n') // Clean up spaces at start of lines
            .trim();

        // Create simplified JSON structure
        const websiteData = {
            mainWebsite: {
                url: mainWebsiteUrl,
                metadata: mainMetadata,
                extractedAt: new Date().toISOString()
            },
            termsOfService: {
                url: tosUrl,
                plainText: cleanText,
                extractedAt: new Date().toISOString()
            }
        };

        // Save to file
        const filename = `${websiteOrBrand.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_metadata.json`;
        require('fs').writeFileSync(
            filename,
            JSON.stringify(websiteData, null, 2)
        );

        console.log(`Website data extracted and saved to ${filename}`);
        console.log('Main website URL:', mainWebsiteUrl);
        console.log('ToS URL:', tosUrl);
        
        return websiteData;
        
    } catch (error) {
        console.error('Error extracting website information:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Get website/brand from command line argument
const input = process.argv[2];
if (!input) {
    console.error('Please provide a website or brand name as an argument.');
    console.error('Usage: node script.js nike.com');
    console.error(' or: node script.js "Nike"');
    process.exit(1);
}

// Run the script
extractCleanWebsiteInfo(input)
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });