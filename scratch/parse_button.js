const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Meet\\.gemini\\antigravity\\brain\\99575de9-e38c-4537-aab8-af5018c3d563\\.system_generated\\steps\\8871\\content.md', 'utf8');

console.log(content.substring(93500, 95500));
