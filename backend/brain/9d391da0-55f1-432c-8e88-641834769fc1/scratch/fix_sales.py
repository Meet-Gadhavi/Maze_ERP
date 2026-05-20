import os

filepath = r'c:\Users\Meet\Music\Maze_ERP\backend\routes\sales.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken pattern
# Match: if (!invoice) res.status(404).json({ error: 'Invoice not found' }); const err = new Error('Abort'); err.apiResponse = true; throw err;
# Replace with braced version
pattern = "if (!invoice) res.status(404).json({ error: 'Invoice not found' }); const err = new Error('Abort'); err.apiResponse = true; throw err;"
replacement = """if (!invoice) {
            res.status(404).json({ error: 'Invoice not found' });
            const err = new Error('Abort');
            err.apiResponse = true;
            throw err;
        }"""

new_content = content.replace(pattern, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Fixed {content.count(pattern)} occurrences.")
