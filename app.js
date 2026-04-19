// ==========================================
// 1. GLOBAL SETUP & STATE MANAGEMENT
// ==========================================
let editor; 

// Grab token from URL
const urlParams = new URLSearchParams(window.location.search);
const userToken = urlParams.get('token');

if (!userToken) {
    alert("CRITICAL ERROR: No access token found in the URL. Your data will not be saved.");
}

// Define the two challenges and their specific Pyodide test scripts
const challenges = [
    {
        id: "task_1_reversal",
        title: "Challenge 1: String Reversal",
        description: `
            <p>Write a Python function named <code>reverse_string(s)</code> that takes a string as input and returns the string reversed.</p>
            <ul>
                <li>Do not use the built-in <code>[::-1]</code> slicing trick.</li>
                <li>Use a loop to construct the new string.</li>
            </ul>`,
        starterCode: "def reverse_string(s):\n    # Write your logic here\n    pass",
        testCases: `
import json
test_cases = [("hello", "olleh"), ("cyber", "rebyc"), ("12345", "54321")]
passed = 0
results = []
for i, (input_val, expected) in enumerate(test_cases):
    try:
        actual = reverse_string(input_val)
        if actual == expected:
            passed += 1
            results.append({"test": i + 1, "status": "PASS", "expected": expected, "got": actual})
        else:
            results.append({"test": i + 1, "status": "FAIL", "expected": expected, "got": actual})
    except Exception as ex:
        results.append({"test": i + 1, "status": "ERROR", "expected": expected, "got": str(ex)})
print(json.dumps({"passed": passed, "total": len(test_cases), "details": results}))
`
    },
    {
        id: "task_2_fizzbuzz",
        title: "Challenge 2: FizzBuzz Logic",
        description: `
            <p>Write a function <code>fizzbuzz(n)</code> that returns a list of numbers from 1 to n, but:</p>
            <ul>
                <li>Multiples of 3 are replaced with "Fizz"</li>
                <li>Multiples of 5 are replaced with "Buzz"</li>
                <li>Multiples of both are replaced with "FizzBuzz"</li>
            </ul>`,
        starterCode: "def fizzbuzz(n):\n    # Write your logic here\n    pass",
        testCases: `
import json
test_cases = [(5, [1, 2, 'Fizz', 4, 'Buzz']), (15, [1, 2, 'Fizz', 4, 'Buzz', 'Fizz', 7, 8, 'Fizz', 'Buzz', 11, 'Fizz', 13, 14, 'FizzBuzz'])]
passed = 0
results = []
for i, (input_val, expected) in enumerate(test_cases):
    try:
        actual = fizzbuzz(input_val)
        if actual == expected:
            passed += 1
            results.append({"test": i + 1, "status": "PASS", "expected": str(expected), "got": str(actual)})
        else:
            results.append({"test": i + 1, "status": "FAIL", "expected": str(expected), "got": str(actual)})
    except Exception as ex:
        results.append({"test": i + 1, "status": "ERROR", "expected": "List", "got": str(ex)})
print(json.dumps({"passed": passed, "total": len(test_cases), "details": results}))
`
    }
];

// Randomize condition (50/50)
const task1IsHonest = Math.random() < 0.5;
const assignedConditions = [
    task1IsHonest ? "HONEST" : "CHEAT",
    task1IsHonest ? "CHEAT" : "HONEST"
];

let currentTaskIndex = 0;

// Initialize the master data object
const sessionData = {
    metadata: { 
        token: userToken, 
        globalStartTime: Date.now(),
        globalEndTime: null,
        status: "in-progress"
    },
    tasks: [
        { 
            id: challenges[0].id, condition: assignedConditions[0], 
            startTime: Date.now(), endTime: null, finalCode: "", 
            events: { keystrokes: [], clicks: [], pastes: [], executions: [] } 
        },
        { 
            id: challenges[1].id, condition: assignedConditions[1], 
            startTime: null, endTime: null, finalCode: "", 
            events: { keystrokes: [], clicks: [], pastes: [], executions: [] } 
        }
    ]
};

// ==========================================
// 2. UI & EDITOR INITIALIZATION
// ==========================================
function loadTaskUI(index) {
    const task = challenges[index];
    const condition = assignedConditions[index];

    document.getElementById('task-title').innerText = task.title;
    document.getElementById('task-desc').innerHTML = task.description;

    const banner = document.getElementById('condition-banner');
    if (condition === "HONEST") {
        banner.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
        banner.style.color = "#10b981";
        banner.innerText = "🛡️ HONEST CONDITION: Solve this entirely from your own memory. Do not switch tabs or copy code.";
    } else {
        banner.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
        banner.style.color = "#ef4444";
        banner.innerText = "🤖 CHEAT CONDITION: Solve this as fast as possible using ChatGPT, Google, or copy-pasting.";
    }

    if (editor) editor.setValue(task.starterCode);
    document.getElementById('consoleDiv').innerHTML = "Waiting for execution...";

    if (index === 0) {
        document.getElementById('next-btn').classList.remove('hidden');
        document.getElementById('submit-btn').classList.add('hidden');
    } else {
        document.getElementById('next-btn').classList.add('hidden');
        document.getElementById('submit-btn').classList.remove('hidden');
    }
}

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: "",
        language: 'python',
        theme: 'vs-dark',
        automaticLayout: true
    });

    attachTelemetryListeners();
    loadTaskUI(0); // Load first task once editor is ready
});

// Toast Notification System
function showToast(message, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { if (container.contains(toast)) toast.remove(); }, 4000);
}

function appendLog(div, msg, colorClass) {
    const span = document.createElement('span');
    span.className = colorClass;
    span.innerText = msg + '\n';
    div.appendChild(span);
}

// ==========================================
// 3. TELEMETRY COLLECTION
// ==========================================
function attachTelemetryListeners() {
    // Note: We push everything to sessionData.tasks[currentTaskIndex].events
    
    document.addEventListener('keydown', (e) => {
        sessionData.tasks[currentTaskIndex].events.keystrokes.push({
            key: e.key,
            timestamp: Date.now()
        });
    });

    document.addEventListener('click', (e) => {
        sessionData.tasks[currentTaskIndex].events.clicks.push({
            x: e.clientX, y: e.clientY,
            target: e.target.tagName,
            timestamp: Date.now()
        });
    });

    document.addEventListener('paste', (e) => {
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        sessionData.tasks[currentTaskIndex].events.pastes.push({
            length: pastedText.length,
            content: pastedText,
            timestamp: Date.now()
        });
    });
}

// ==========================================
// 4. PYODIDE EXECUTION LOGIC
// ==========================================
document.getElementById('run-btn').addEventListener('click', runUnitTestsSecurely);

function runUnitTestsSecurely() {
    const consoleDiv = document.getElementById('consoleDiv');
    consoleDiv.innerHTML = "<span class='normal'>Booting Python environment...</span>\n";
    
    const userCode = editor.getValue();
    const currentTests = challenges[currentTaskIndex].testCases;
    
    // Record execution attempt
    const executionRecord = { timestamp: Date.now(), codeState: userCode, status: "pending", testsPassed: 0 };

    const workerCode = `
        importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");
        self.onmessage = async function(e) {
            try {
                let pyodide = await loadPyodide();
                const fullCode = e.data.userCode + "\\n" + e.data.testCode;
                
                // Redirect Python's stdout to capture the printed JSON string
                pyodide.runPython(\`
import sys
import io
sys.stdout = io.StringIO()
                \`);
                
                await pyodide.runPythonAsync(fullCode);
                
                // Extract the printed string
                let stdout = pyodide.runPython("sys.stdout.getvalue()");
                let result = JSON.parse(stdout);
                
                self.postMessage({ success: true, passed: result.passed, total: result.total, details: result.details });
            } catch (err) {
                self.postMessage({ success: false, error: err.message });
            }
        };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));

    const timeout = setTimeout(() => {
        worker.terminate();
        appendLog(consoleDiv, "[ERROR] Execution timed out (Infinite loop?)", "fail");
        executionRecord.status = "timeout";
        sessionData.tasks[currentTaskIndex].events.executions.push(executionRecord);
    }, 10000);

    worker.onmessage = function(e) {
        clearTimeout(timeout);
        const data = e.data;
        consoleDiv.innerHTML = ""; // Clear booting text

        if (data.success) {
            executionRecord.status = "success";
            executionRecord.testsPassed = data.passed;
            data.details.forEach(res => {
                const colorClass = res.status === "PASS" ? "pass" : "fail";
                appendLog(consoleDiv, `[${res.status}] Test ${res.test}: expected "${res.expected}", got "${res.got}"`, colorClass);
            });
            appendLog(consoleDiv, `\nTotal: ${data.passed}/${data.total} tests passed.`, "normal");
        } else {
            executionRecord.status = "error";
            executionRecord.errorMsg = data.error;
            appendLog(consoleDiv, `[ERROR] ${data.error}`, "fail");
        }
        
        sessionData.tasks[currentTaskIndex].events.executions.push(executionRecord);
        worker.terminate();
    };

    worker.postMessage({ userCode: userCode, testCode: currentTests });
}

// ==========================================
// 5. SERVER COMMUNICATION & NAVIGATION
// ==========================================
const SERVER_URL = "https://timisoreanul.pythonanywhere.com/api/submit-telemetry";

async function saveProgressToServer(type, isClosing = false) {
    sessionData.metadata.status = type;
    if (editor) {
        sessionData.tasks[currentTaskIndex].finalCode = editor.getValue();
    }

    try {
        await fetch(SERVER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sessionData),
            keepalive: isClosing
        });
        if (type === "auto-save" && !isClosing) console.log("Auto-save successful at " + new Date().toLocaleTimeString());
    } catch (error) {
        console.error("Save failed:", error);
    }
}

// Auto-save loop (Every 60s)
const autoSaveInterval = setInterval(() => saveProgressToServer("auto-save"), 60000);

// Save on Tab Close
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        sessionData.metadata.globalEndTime = Date.now();
        sessionData.tasks[currentTaskIndex].endTime = Date.now();
        saveProgressToServer("auto-save", true);
    }
});

// Next Challenge Button
document.getElementById('next-btn').addEventListener('click', () => {
    sessionData.tasks[currentTaskIndex].endTime = Date.now();
    sessionData.tasks[currentTaskIndex].finalCode = editor.getValue();
    
    currentTaskIndex++;
    sessionData.tasks[currentTaskIndex].startTime = Date.now();
    
    loadTaskUI(currentTaskIndex);
    saveProgressToServer("auto-save");
});

// Submit Button (Triggers Modal)
const submitModal = document.getElementById('submit-modal');
const btnCancel = document.getElementById('modal-cancel');
const btnConfirm = document.getElementById('modal-confirm');

document.getElementById('submit-btn').addEventListener('click', () => submitModal.classList.remove('hidden'));
btnCancel.addEventListener('click', () => submitModal.classList.add('hidden'));

// Final Submission Confirmation
btnConfirm.addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.innerText = "Uploading Data...";
    btnCancel.disabled = true;

    clearInterval(autoSaveInterval);
    sessionData.metadata.group = document.getElementById('experiment-group').value;
    
    sessionData.tasks[currentTaskIndex].endTime = Date.now();
    sessionData.tasks[currentTaskIndex].finalCode = editor.getValue();
    sessionData.metadata.globalEndTime = Date.now();
    
    await saveProgressToServer("final");
    window.location.href = "thank_you.html";
});