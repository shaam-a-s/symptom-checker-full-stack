# AI Symptom Checker - Full-Stack Project

This is a complete full-stack web application for symptom analysis and disease prediction. It includes a React frontend, a Django backend, and a Python machine learning model.

## How to Run This Project (Follow in Order)

### Prerequisites
- Python 3.8+
- Node.js and npm

---

### Step 1: Train the AI Model

This step only needs to be done once. It creates the `saved_model` files that the backend needs to make predictions.

1.  **Navigate to the project root:**
    ```bash
    cd symptom-checker-full-stack
    ```

2.  **Install Python dependencies for training:**
    ```bash
    pip install pandas scikit-learn joblib numpy
    ```

3.  **Run the training script:**
    ```bash
    python train_model.py
    ```
    This will create a `saved_model` folder in your project root.

---

### Step 2: Set Up and Run the Django Backend

1.  **Move the trained model into the backend:**
    - Move the `saved_model` folder (created in Step 1) inside the `backend` directory.

2.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

3.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv\Scripts\activate  # On Windows, use `venv\Scripts\activate`
    ```

4.  **Install backend dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Run the backend server:**
    ```bash
    python manage.py runserver
    ```
    The backend API will now be running at `http://127.0.0.1:8000`. Keep this terminal open.

---

### Step 3: Set Up and Run the React Frontend

1.  **Open a new terminal window.**

2.  **Navigate to the frontend directory:**
    ```bash
    cd symptom-checker-full-stack/frontend
    ```

3.  **Install frontend dependencies:**
    ```bash
    npm install
    ```

4.  **Run the frontend development server:**
    ```bash
    npm start
    ```
    Your browser should automatically open to `http://localhost:3000`.