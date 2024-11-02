// firstPage.js
const { chromium } = require('playwright');
const { JSDOM } = require('jsdom');

async function getMessageHistory() {
    try {
        const messages = await require('fs').promises.readFile('allMessages.txt', 'utf8');
        return messages;
    } catch {
        try {
            const dummyData = await require('fs').promises.readFile('dummyLinkedIn.txt', 'utf8');
            return dummyData;
        } catch {
            console.warn('No message history found');
            return '';
        }
    }
}

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
            const content = document.body.innerText || document.body.textContent;
            
            return content
                .replace(/\s+/g, ' ')
                .replace(/[\r\n]+/g, '\n')
                .trim();
        });

        // Clean the text
        const cleanText = tosContent
            .replace(/['"]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/\n\s+/g, '\n')
            .trim();

        // Get message history
        const messageHistory = await getMessageHistory();

        // Create combined data structure
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
            },
            messageHistory: messageHistory
        };

        // Save to file
        const filename = `${websiteOrBrand.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_combined_data.json`;
        require('fs').writeFileSync(
            filename,
            JSON.stringify(websiteData, null, 2)
        );

        console.log(`Combined data extracted and saved to ${filename}`);
        console.log('Main website URL:', mainWebsiteUrl);
        console.log('ToS URL:', tosUrl);
        console.log('Message history included:', messageHistory ? 'Yes' : 'No');
        
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
    console.error('Usage: node script.js example.com');
    console.error(' or: node script.js "Brand Name"');
    process.exit(1);
}

// Run the script
extractCleanWebsiteInfo(input)
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });