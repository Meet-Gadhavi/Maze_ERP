import re

filepath = r'c:\Users\Meet\Music\Maze_ERP\Plans_MazeERP\fix.md'

with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace | C001 | with | ✅ C001 | for all numbers from 001 to 023
for i in range(1, 24):
    id_str = f"C{i:03d}"
    code = code.replace(f"| {id_str} |", f"| ✅ {id_str} |")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Marked C001 to C023 as fixed in fix.md")
