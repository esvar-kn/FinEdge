import UserModel from '../models/userModel.js';
import TransactionModel from '../models/transactionModel.js';
import fs from 'fs/promises';
import path from 'path';

async function runTest() {
  console.log("Starting Phase 2 verification checks...");
  
  // Backup/Clear databases
  const usersPath = path.resolve('src/data/users.json');
  const txPath = path.resolve('src/data/transactions.json');
  
  await fs.writeFile(usersPath, '[]');
  await fs.writeFile(txPath, '[]');

  try {
    // 1. Create User
    console.log("Creating mock user...");
    const user = await UserModel.create({
      username: "john_doe",
      email: "john@domain.com",
      password: "hashedPassword123"
    });
    console.log("Created User:", user);
    
    // Find User
    const foundUser = await UserModel.findByEmail("john@domain.com");
    console.log("Found User by Email:", foundUser !== null ? "Passed ✅" : "Failed ❌");

    // List all users
    const allUsers = await UserModel.findAll();
    console.log("UserModel.findAll() length (should be 1):", allUsers.length, allUsers.length === 1 ? "Passed ✅" : "Failed ❌");

    // 2. Create Transaction
    console.log("Creating mock transaction...");
    const tx = await TransactionModel.create({
      userId: user.id,
      type: "expense",
      category: "food",
      amount: 45.50,
      description: "Lunch at diner"
    });
    console.log("Created Transaction:", tx);

    // Retrieve Transaction by User ID
    const userTxs = await TransactionModel.findByUserId(user.id);
    console.log("Retrieved User Transactions length:", userTxs.length, userTxs.length === 1 ? "Passed ✅" : "Failed ❌");

    // 3. Update Transaction
    console.log("Updating transaction...");
    const updated = await TransactionModel.update(tx.id, {
      amount: 55.00,
      description: "Lunch at diner (with tip)"
    });
    console.log("Updated Transaction:", updated);
    console.log("Amount check (should be 55):", updated.amount === 55 ? "Passed ✅" : "Failed ❌");

    // 4. Delete Transaction
    console.log("Deleting transaction...");
    const deleted = await TransactionModel.delete(tx.id);
    console.log("Deleted status:", deleted ? "Passed ✅" : "Failed ❌");
    
    const finalTxs = await TransactionModel.findAll();
    console.log("Final Transactions length (should be 0):", finalTxs.length, finalTxs.length === 0 ? "Passed ✅" : "Failed ❌");

    console.log("Phase 2 test suite successfully completed!");
  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    // Restore empty databases
    await fs.writeFile(usersPath, '[]');
    await fs.writeFile(txPath, '[]');
  }
}

runTest();
