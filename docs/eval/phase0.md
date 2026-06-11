# Phase 0 Evaluation Criteria: Development Environment & Prerequisites

This document outlines the validation standards and checklist to verify the developer's local environment before starting the implementation phases.

---

## 1. Evaluation Objectives
- Confirm the developer's computer has Node.js and npm installed with the correct minimum versions.
- Ensure the project directory is accessible and has appropriate read and write permissions.

---

## 2. Detailed Success Criteria
- **Node.js**: Version must be equal to or greater than `18.0.0`.
- **npm**: Version must be equal to or greater than `9.0.0`.
- **System Access**: The developer must be able to read and write files inside `/Users/esvarnatarajan/Desktop/Airtribe/Projects/FinEdge/`.

---

## 3. Step-by-Step Test Scenarios

### Test Scenario 0.1: Node.js & npm Version Verification
- **Action**: Run the following commands in the terminal:
  ```bash
  node -v
  npm -v
  ```
- **Expected Result**: 
  - The Node version must be $\ge$ `v18.0.0` (e.g. `v18.16.0` or `v20.x.x`).
  - The npm version must be $\ge$ `9.0.0` (e.g. `9.6.7` or `10.x.x`).

### Test Scenario 0.2: File Permissions Check
- **Action**: Check if a test file can be written and deleted in the workspace root:
  ```bash
  echo "test" > write_test.txt && rm write_test.txt
  ```
- **Expected Result**: The commands complete without permissions errors (e.g., `Permission denied`).
