import re

filepath = r'c:\Users\Meet\Music\Maze_ERP\renderer\src\pages\SalesPage.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

target = """                                                                    <CustomSelect
                                                                        value={p.method}
                                                                        onChange={val => {
                                                                            const newPayments = [...payments];
                                                                            newPayments[idx] = { ...newPayments[idx], method: val };
                                                                            setPayments(newPayments);
                                                                        }}
                                                                        options={[
                                                                            { value: 'Cash', label: 'Cash' },
                                                                            { value: 'UPI', label: 'UPI' },
                                                                            { value: 'Card', label: 'Card' },
                                                                            { value: 'Cheque', label: 'Cheque' },
                                                                            { value: 'Wallet', label: 'Wallet' },
                                                                        ]}
                                                                    />"""

replacement = """                                                                    <select
                                                                        value={p.method}
                                                                        onChange={e => {
                                                                            const newPayments = [...payments];
                                                                            newPayments[idx] = { ...newPayments[idx], method: e.target.value };
                                                                            setPayments(newPayments);
                                                                        }}
                                                                        style={{ width: '100%', height: '42px', padding: '0 12px', fontSize: 'var(--font-size-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: '#fff', fontWeight: '500', outline: 'none' }}
                                                                    >
                                                                        <option value="Cash">Cash</option>
                                                                        <option value="UPI">UPI</option>
                                                                        <option value="Card">Card</option>
                                                                        <option value="Cheque">Cheque</option>
                                                                        <option value="Wallet">Wallet</option>
                                                                    </select>"""

if target in code:
    code = code.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Fixed SalesPage.jsx")
else:
    print("Target not found")
