const fs = require('fs');
const content = fs.readFileSync('C:/Users/jahnh/.gemini/antigravity-cli/brain/23f8fd49-86ea-41d6-b28e-c76ca7142725/.system_generated/steps/486/content.md', 'utf8');

const regex = /href=[\"'](.*?)[\"']/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const url = match[1].toLowerCase();
    if (url.includes('margin') || url.includes('xls') || url.includes('csv')) {
        console.log(url);
    }
}
