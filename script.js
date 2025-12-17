// Splitwise Application Data
let appData = {
    users: [],
    expenses: [],
    balances: {}
};

// Settlement tracking
let currentSettlement = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    updateUI();
    
    // Set up expense form submission
    document.getElementById('expenseForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addExpense();
    });
});

// Load data from localStorage
function loadData() {
    const savedData = localStorage.getItem('splitwiseData');
    if (savedData) {
        appData = JSON.parse(savedData);
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('splitwiseData', JSON.stringify(appData));
}

// Add a new user
function addUser() {
    const nameInput = document.getElementById('userName');
    const name = nameInput.value.trim();
    
    if (name === '') {
        alert('Please enter a name');
        return;
    }
    
    if (appData.users.find(user => user.name === name)) {
        alert('This user already exists');
        return;
    }
    
    const newUser = {
        id: Date.now().toString(),
        name: name
    };
    
    appData.users.push(newUser);
    appData.balances[newUser.id] = 0;
    
    nameInput.value = '';
    saveData();
    updateUI();
}

// Remove a user
function removeUser(userId) {
    appData.users = appData.users.filter(user => user.id !== userId);
    delete appData.balances[userId];
    
    // Remove user from expenses
    appData.expenses = appData.expenses.filter(expense => {
        expense.splits = expense.splits.filter(split => split.userId !== userId);
        return expense.splits.length > 0;
    });
    
    saveData();
    updateUI();
}

// Add a new expense
function addExpense() {
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const paidBy = document.getElementById('paidBy').value;
    
    if (description === '' || isNaN(amount) || amount <= 0 || paidBy === '') {
        alert('Please fill in all expense details correctly');
        return;
    }
    
    // Get selected users for split
    const splitCheckboxes = document.querySelectorAll('.split-checkbox input[type="checkbox"]:checked');
    if (splitCheckboxes.length === 0) {
        alert('Please select at least one person to split with');
        return;
    }
    
    const splits = [];
    let totalSplitAmount = 0;
    
    splitCheckboxes.forEach(checkbox => {
        const userId = checkbox.value;
        const amountInput = document.getElementById(`split-${userId}`);
        const splitAmount = parseFloat(amountInput.value) || (amount / splitCheckboxes.length);
        
        splits.push({
            userId: userId,
            amount: splitAmount
        });
        totalSplitAmount += splitAmount;
    });
    
    // Validate split amounts
    if (Math.abs(totalSplitAmount - amount) > 0.01) {
        alert('Split amounts must equal the total expense amount');
        return;
    }
    
    const newExpense = {
        id: Date.now().toString(),
        description: description,
        amount: amount,
        paidBy: paidBy,
        splits: splits,
        date: new Date().toISOString()
    };
    
    appData.expenses.push(newExpense);
    
    // Reset form
    document.getElementById('expenseForm').reset();
    
    saveData();
    calculateBalances();
    updateUI();
}

// Calculate balances between users
function calculateBalances() {
    // Reset all balances to 0
    appData.users.forEach(user => {
        appData.balances[user.id] = 0;
    });
    
    // Process each expense
    appData.expenses.forEach(expense => {
        // Add to payer's balance (they are owed money)
        appData.balances[expense.paidBy] += expense.amount;
        
        // Subtract from each person's balance (they owe money)
        expense.splits.forEach(split => {
            appData.balances[split.userId] -= split.amount;
        });
    });
    
    saveData();
}

// Settle up between users
function settleUp(userId1, userId2) {
    const user1 = appData.users.find(u => u.id === userId1);
    const user2 = appData.users.find(u => u.id === userId2);
    
    if (!user1 || !user2) return;
    
    const amount = Math.min(Math.abs(appData.balances[userId1]), Math.abs(appData.balances[userId2]));
    
    // Create settlement expense
    const settlementExpense = {
        id: Date.now().toString(),
        description: `Settlement: ${user1.name} paid ${user2.name}`,
        amount: amount,
        paidBy: appData.balances[userId1] > 0 ? userId1 : userId2,
        splits: [{
            userId: appData.balances[userId1] > 0 ? userId2 : userId1,
            amount: amount
        }],
        date: new Date().toISOString(),
        isSettlement: true
    };
    
    appData.expenses.push(settlementExpense);
    
    calculateBalances();
    updateUI();
}

// Update the entire UI
function updateUI() {
    updateUsersList();
    updateExpenseForm();
    updateBalancesList();
    updateExpensesList();
}

// Update users list
function updateUsersList() {
    const usersList = document.getElementById('usersList');
    
    if (appData.users.length === 0) {
        usersList.innerHTML = '<div class="empty-state">No friends added yet</div>';
        return;
    }
    
    usersList.innerHTML = appData.users.map(user => `
        <div class="user-tag">
            ${user.name}
            <span class="remove" onclick="removeUser('${user.id}')">×</span>
        </div>
    `).join('');
}

// Update expense form options
function updateExpenseForm() {
    const paidBySelect = document.getElementById('paidBy');
    const splitCheckboxes = document.getElementById('splitCheckboxes');
    
    // Update "paid by" dropdown
    paidBySelect.innerHTML = '<option value="">Who paid?</option>' +
        appData.users.map(user => `<option value="${user.id}">${user.name}</option>`).join('');
    
    // Update split checkboxes
    if (appData.users.length === 0) {
        splitCheckboxes.innerHTML = '<div class="empty-state">Add friends first to split expenses</div>';
    } else {
        splitCheckboxes.innerHTML = appData.users.map(user => `
            <div class="split-checkbox">
                <label>
                    <input type="checkbox" value="${user.id}" onchange="updateSplitAmount('${user.id}')">
                    ${user.name}
                </label>
                <input type="number" id="split-${user.id}" placeholder="Amount" step="0.01" min="0">
            </div>
        `).join('');
    }
}

// Split equally among all friends
function splitEqually() {
    const totalAmount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    if (totalAmount <= 0) {
        alert('Please enter an amount first');
        return;
    }
    
    if (appData.users.length === 0) {
        alert('Please add friends first');
        return;
    }
    
    // Check all checkboxes
    const checkboxes = document.querySelectorAll('.split-checkbox input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Calculate equal split
    const equalSplit = totalAmount / appData.users.length;
    
    // Set equal amounts for all users
    appData.users.forEach(user => {
        const amountInput = document.getElementById(`split-${user.id}`);
        amountInput.value = equalSplit.toFixed(2);
        amountInput.disabled = false;
    });
}

// Update split amount fields
function updateSplitAmount(userId) {
    const checkbox = document.querySelector(`.split-checkbox input[value="${userId}"]`);
    const amountInput = document.getElementById(`split-${userId}`);
    const totalAmount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    if (checkbox.checked) {
        const checkedBoxes = document.querySelectorAll('.split-checkbox input[type="checkbox"]:checked');
        const equalSplit = totalAmount / checkedBoxes.length;
        amountInput.value = equalSplit.toFixed(2);
        amountInput.disabled = false;
    } else {
        amountInput.value = '';
        amountInput.disabled = true;
    }
}

// Update balances list
function updateBalancesList() {
    const balancesList = document.getElementById('balancesList');
    
    const balancesWithDetails = appData.users.map(user => ({
        user: user,
        balance: appData.balances[user.id] || 0
    })).filter(item => Math.abs(item.balance) > 0.01);
    
    if (balancesWithDetails.length === 0) {
        balancesList.innerHTML = '<div class="empty-state">All settled up!</div>';
        return;
    }
    
    balancesList.innerHTML = balancesWithDetails.map(item => `
        <div class="balance-item ${item.balance > 0 ? 'owed' : 'owes'}">
            <div>
                <strong>${item.user.name}</strong>
                <div class="balance-details">
                    ${item.balance > 0 ? 'is owed' : 'owes'} 
                    <span class="balance-amount ${item.balance > 0 ? 'positive' : 'negative'}">
                        $${Math.abs(item.balance).toFixed(2)}
                    </span>
                </div>
            </div>
            ${item.balance < 0 ? `<button class="settle-btn" onclick="showSettleOptions('${item.user.id}')">Settle Up</button>` : ''}
        </div>
    `).join('');
    
    // Add "Settle All" button if there are users who owe money
    const usersWhoOwe = balancesWithDetails.filter(item => item.balance < 0);
    if (usersWhoOwe.length > 1) {
        balancesList.innerHTML += `
            <button class="settle-all-btn" onclick="settleAllUsers()">
                Settle All (${usersWhoOwe.length} users)
            </button>
        `;
    }
}

// Update expenses list
function updateExpensesList() {
    const expensesList = document.getElementById('expensesList');
    
    if (appData.expenses.length === 0) {
        expensesList.innerHTML = '<div class="empty-state">No expenses yet</div>';
        return;
    }
    
    const sortedExpenses = [...appData.expenses].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    expensesList.innerHTML = sortedExpenses.slice(0, 10).map(expense => {
        const paidByUser = appData.users.find(u => u.id === expense.paidBy);
        const splitDetails = expense.splits.map(split => {
            const user = appData.users.find(u => u.id === split.userId);
            return `${user.name}: $${split.amount.toFixed(2)}`;
        }).join(', ');
        
        return `
            <div class="expense-item ${expense.isSettlement ? 'settlement' : ''}">
                <div class="expense-header">
                    <span class="expense-description">${expense.description}</span>
                    <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
                </div>
                <div class="expense-details">
                    Paid by ${paidByUser.name} • ${new Date(expense.date).toLocaleDateString()}
                </div>
                <div class="expense-split">
                    Split: ${splitDetails}
                </div>
            </div>
        `;
    }).join('');
}

// Settlement Functions
function showSettleOptions(userId) {
    const user = appData.users.find(u => u.id === userId);
    const balance = appData.balances[userId] || 0;
    
    if (balance >= 0) {
        alert('This user doesn\'t owe anything!');
        return;
    }
    
    currentSettlement = {
        userId: userId,
        userName: user.name,
        amount: Math.abs(balance)
    };
    
    document.getElementById('settlementMessage').textContent = 
        `Settle $${currentSettlement.amount.toFixed(2)} for ${currentSettlement.userName}?`;
    document.getElementById('settlementModal').style.display = 'block';
}

function closeSettlementModal() {
    document.getElementById('settlementModal').style.display = 'none';
    currentSettlement = null;
}


function settleAllUsers() {
    const usersWithBalances = appData.users.filter(user => 
        appData.balances[user.id] && appData.balances[user.id] < 0
    );
    
    if (usersWithBalances.length === 0) {
        alert('No users have outstanding balances to settle!');
        return;
    }
    
    const totalAmount = usersWithBalances.reduce((sum, user) => 
        sum + Math.abs(appData.balances[user.id]), 0
    );
    
    currentSettlement = {
        isSettleAll: true,
        users: usersWithBalances,
        totalAmount: totalAmount
    };
    
    const userNames = usersWithBalances.map(u => u.name).join(', ');
    document.getElementById('settlementMessage').textContent = 
        `Settle all balances for ${userNames}? Total: $${totalAmount.toFixed(2)}`;
    document.getElementById('settlementModal').style.display = 'block';
}

function confirmSettlement() {
    if (!currentSettlement) return;
    
    if (currentSettlement.isSettleAll) {
        // Settle all users
        currentSettlement.users.forEach(user => {
            const amount = Math.abs(appData.balances[user.id]);
            
            const settlementExpense = {
                id: Date.now().toString() + '_' + user.id,
                description: `Settlement: ${user.name} settled up`,
                amount: amount,
                paidBy: user.id,
                splits: [],
                date: new Date().toISOString(),
                isSettlement: true
            };
            
            appData.expenses.push(settlementExpense);
            appData.balances[user.id] = 0;
        });
        
        saveData();
        updateUI();
        closeSettlementModal();
        
        setTimeout(() => {
            alert(`All ${currentSettlement.users.length} users have been settled! Total: $${currentSettlement.totalAmount.toFixed(2)}`);
        }, 100);
    } else {
        // Single user settlement (existing logic)
        const settlementExpense = {
            id: Date.now().toString(),
            description: `Settlement: ${currentSettlement.userName} settled up`,
            amount: currentSettlement.amount,
            paidBy: currentSettlement.userId,
            splits: [],
            date: new Date().toISOString(),
            isSettlement: true
        };
        
        appData.expenses.push(settlementExpense);
        appData.balances[currentSettlement.userId] = 0;
        
        saveData();
        updateUI();
        closeSettlementModal();
        
        setTimeout(() => {
            alert(`${currentSettlement.userName} has settled $${currentSettlement.amount.toFixed(2)}`);
        }, 100);
    }
}
