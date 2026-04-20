// ==========================================
// 1. GLOBAL SETUP & STATE MANAGEMENT
// ==========================================
let editor; 

// Grab token from URL
const urlParams = new URLSearchParams(window.location.search);
const userToken = urlParams.get('token');

if (localStorage.getItem('sessionCompleted') === 'true') {
    window.location.replace("thank_you.html");
}

if (!userToken) {
    alert("CRITICAL ERROR: No access token found in the URL. Your data will not be saved.");
}

// Block Refresh and Tab Close
const preventNavigation = (e) => {
    e.preventDefault();
    e.returnValue = ''; // Required by Chrome to show the warning prompt
};

window.addEventListener('beforeunload', preventNavigation);

// Trap the Back/Forward Buttons
window.history.pushState(null, null, window.location.href);
window.onpopstate = function () {
    window.history.pushState(null, null, window.location.href);
    showToast("Navigation disabled during the active session.", "warning");
};

// Define the two challenges and their specific Pyodide test scripts
const challenges = [
    {
        id: "task_1_blackjack",
        title: "Challenge 1: Calculate the value of a blackjack hand",
        description: `
            <h4>Problem Description</h4>
            <p>Write a Python function named <code>calculate_hand_value(cards)</code> that calculates the total value of a blackjack hand. Card ranks are: 2-9, 10, J, Q, K, A.</p>
            <p><strong>Scoring rules:</strong></p>
            <ul>
                <li>Number cards (2-9) are worth their face value</li>
                <li>10 and face cards (J, Q, K) are worth 10</li>
                <li>Ace (A) is worth 1 or 11 depending on the hand - use 11 if possible without exceeding 21, otherwise use 1</li>
            </ul>
            
            <h4>Input</h4>
            <p>A list of card rank strings. The hand will contain between 1 and 5 cards. Example: <code>["2", "K", "A"]</code></p>
            
            <h4>Output</h4>
            <p>An integer representing the total value of the hand.</p>
            
            <h4>Example</h4>
            <p><code>calculate_hand_value(["A", "9"])</code> should return <code>20</code></p>
        `,
        starterCode: "def calculate_hand_value(cards):\n    # Write your logic here\n    pass",
        testCases: `
import json
test_cases = [
    (["2", "3"], 5),
    (["K", "Q", "J"], 30),
    (["A", "9"], 20),
    (["10", "5", "4"], 19),
    (["K", "Q", "A"], 21),
    (["A", "K", "Q"], 21),
    (["A", "A", "9"], 21)
]
passed = 0
results = []
for i, (input_val, expected) in enumerate(test_cases):
    try:
        actual = calculate_hand_value(input_val)
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
            <h4>Problem Description</h4>
            <p>Write a function <code>fizzbuzz(n, divisor1, divisor2, word1, word2)</code> that returns a list of numbers from 1 to n, with special rules for multiples:</p>
            <ul>
                <li>Multiples of <code>divisor1</code> are replaced with <code>word1</code></li>
                <li>Multiples of <code>divisor2</code> are replaced with <code>word2</code></li>
                <li>Multiples of both divisors are replaced with <code>word1 + word2</code> (concatenated)</li>
            </ul>
            
            <h4>Input</h4>
            <p>An integer <code>n</code> representing the upper limit (inclusive), two integers <code>divisor1</code> and <code>divisor2</code>, and two strings <code>word1</code> and <code>word2</code>.</p>
            
            <h4>Output</h4>
            <p>A list containing integers and strings according to the FizzBuzz rules.</p>
            
            <h4>Example</h4>
            <p><code>fizzbuzz(5, 3, 5, "Fizz", "Buzz")</code> should return <code>[1, 2, 'Fizz', 4, 'Buzz']</code></p>
        `,
        starterCode: "def fizzbuzz(n, divisor1, divisor2, word1, word2):\n    # Write your logic here\n    pass",
        testCases: `
import json
test_cases = [
    (5, 3, 5, "Fizz", "Buzz", [1, 2, 'Fizz', 4, 'Buzz']),
    (15, 3, 5, "Fizz", "Buzz", [1, 2, 'Fizz', 4, 'Buzz', 'Fizz', 7, 8, 'Fizz', 'Buzz', 11, 'Fizz', 13, 14, 'FizzBuzz']),
    (10, 2, 3, "Even", "Three", [1, 'Even', 'Three', 'Even', 5, 'EvenThree', 7, 'Even', 'Three', 'Even']),
    (7, 2, 4, "Foo", "Bar", [1, 'Foo', 3, 'FooBar', 5, 'Foo', 7]),
    (12, 3, 4, "X", "Y", [1, 2, 'X', 'Y', 5, 'X', 7, 'Y', 'X', 10, 11, 'XY'])
]
passed = 0
results = []
for i, (n, d1, d2, w1, w2, expected) in enumerate(test_cases):
    try:
        actual = fizzbuzz(n, d1, d2, w1, w2)
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
            events: { keystrokes: [], clicks: [], pastes: [], executions: [], focusEvents: [] } 
        },
        { 
            id: challenges[1].id, condition: assignedConditions[1], 
            startTime: null, endTime: null, finalCode: "", 
            events: { keystrokes: [], clicks: [], pastes: [], executions: [], focusEvents: [] } 
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
        banner.innerText = "HONEST CHALLENGE: Solve this using entirely your own knowledge. Do not switch tabs or copy code.";
    } else {
        banner.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
        banner.style.color = "#ef4444";
        banner.innerText = "DISHONEST CHALLENGE: Use everything at your disposal to solve this challenge. PLEASE CHEAT!";
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

    startGlobalTimer();

    editor.onDidPaste((e) => {
        // 'e.range' contains the exact coordinates of the newly pasted text.
        // We use the editor's model to grab the actual string from those coordinates.
        const pastedText = editor.getModel().getValueInRange(e.range);
        
        sessionData.tasks[currentTaskIndex].events.pastes.push({
            length: pastedText.length,
            content: pastedText, // Now you actually get the cheated code!
            timestamp: Date.now()
        });
        
        console.log(`[Telemetry] Captured paste of ${pastedText.length} characters.`);
    });
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

    window.addEventListener('blur', () => {
        sessionData.tasks[currentTaskIndex].events.focusEvents.push({
            action: "lost_focus",
            timestamp: Date.now()
        });
    });

    // Tracks when they return to your application
    window.addEventListener('focus', () => {
        sessionData.tasks[currentTaskIndex].events.focusEvents.push({
            action: "gained_focus",
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
    if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
    
    // Close out timestamps and code
    sessionData.tasks[currentTaskIndex].endTime = Date.now();
    if (editor) {
        sessionData.tasks[currentTaskIndex].finalCode = editor.getValue();
    }
    sessionData.metadata.globalEndTime = Date.now();
    
    await saveProgressToServer("final");

    window.removeEventListener('beforeunload', preventNavigation);
    // Drop a permanent lock in local storage
    localStorage.setItem('sessionCompleted', 'true');

    // Replace the current history state so they can't hit "Back"
    window.location.replace("thank_you.html");
});

// ==========================================
// 6. GLOBAL COUNTDOWN TIMER
// ==========================================
let timeRemaining = 20 * 60; // 20 minutes in seconds
let timerInterval;

function startGlobalTimer() {
    const timerDisplay = document.getElementById('timer-display');
    
    timerInterval = setInterval(async () => {
        timeRemaining--;
        
        // Calculate minutes and seconds
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        // Format to always show two digits (e.g., 09:05)
        timerDisplay.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Visual Warning at 2 minutes remaining
        if (timeRemaining === 120) {
            timerDisplay.style.color = "var(--danger)";
            showToast("Only 2 minutes remaining!", "error");
        }

        // TIME IS UP!
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            clearInterval(autoSaveInterval);
            
            showToast("Time is up! Auto-submitting your session...", "error");
            
            // 1. Lock the UI so they can't type anymore
            document.getElementById('editor-container').style.pointerEvents = 'none';
            document.querySelector('.btn-group').style.pointerEvents = 'none';
            
            // 2. Finalize timestamps and data
            sessionData.tasks[currentTaskIndex].endTime = Date.now();
            if (editor) {
                sessionData.tasks[currentTaskIndex].finalCode = editor.getValue();
            }
            sessionData.metadata.globalEndTime = Date.now();
            
            // Flag that this was a forced timeout, not a normal submission
            sessionData.metadata.status = "time_expired"; 
            
            // 3. Save to server and redirect
            await saveProgressToServer("final");
            window.location.href = "thank_you.html";
        }
    }, 1000); // Run every 1000ms (1 second)
}