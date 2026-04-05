// 1. Initialize Data Structure
const sessionData = {
    metadata: {
        startTime: Date.now(),
        endTime: null,
        group: "honest"
    },
    events: {
        keystrokes: [],
        pastes: [],
        focusChanges: [],
        executions: [] 
    },
    finalCode: ""
};

// 2. Load Monaco Editor
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    const editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: '# Challenge: Write a function named "reverse_string"\n\ndef reverse_string(s):\n    # Write your logic here\n    pass',
        language: 'python',
        theme: 'vs-dark'
    });

    attachTelemetryListeners(editor);
});

// 3. Telemetry Listeners
function attachTelemetryListeners(editor) {
    editor.onKeyDown((e) => sessionData.events.keystrokes.push({ key: e.browserEvent.key, timestamp: Date.now() }));
    editor.onDidPaste((e) => sessionData.events.pastes.push({ timestamp: Date.now(), characterCount: editor.getModel().getValueInRange(e.range).length }));
    window.addEventListener('blur', () => sessionData.events.focusChanges.push({ state: 'lost_focus', timestamp: Date.now() }));
    window.addEventListener('focus', () => sessionData.events.focusChanges.push({ state: 'gained_focus', timestamp: Date.now() }));

    // Handle "Run Code" Button
    document.getElementById('run-btn').addEventListener('click', () => {
        runUnitTestsSecurely(editor.getValue());
    });

    // Handle Submit
    document.getElementById('submit-btn').addEventListener('click', () => {
        sessionData.metadata.group = document.getElementById('experiment-group').value;
        exportData(editor.getValue()); 
    });
}

// 4. Secure Python Test Runner
function runUnitTestsSecurely(userCode) {
    const consoleDiv = document.getElementById('console-output');
    consoleDiv.innerHTML = ""; 
    appendLog(consoleDiv, "Booting Python environment (this takes a second)...", "normal");

    let executionRecord = { timestamp: Date.now(), status: "pending", testsPassed: 0, errorMsg: null };

    // Notice the escaped backticks (\`) around the Python code below
    const workerLogic = `
        importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

        self.onmessage = async function(e) {
            const userCode = e.data.code;
            
            try {
                let pyodide = await loadPyodide();
                
                const testRunnerCode = \`
test_cases = [
    ("hello", "olleh"),
    ("cyber", "rebyc"),
    ("12345", "54321")
]
passed = 0
results = []

for input_val, expected in test_cases:
    try:
        actual = reverse_string(input_val)
        if actual == expected:
            passed += 1
            results.append({"status": "PASS", "expected": expected, "got": actual})
        else:
            results.append({"status": "FAIL", "expected": expected, "got": actual})
    except Exception as ex:
        results.append({"status": "ERROR", "expected": expected, "got": str(ex)})

{"passed": passed, "total": len(test_cases), "details": results}
\`;
                
                const finalCode = userCode + "\\n" + testRunnerCode;
                let resultProxy = await pyodide.runPythonAsync(finalCode);
                let result = resultProxy.toJs({dict_converter: Object.fromEntries});
                
                // Send the exact properties the listener expects
                self.postMessage({ success: true, passed: result.passed, total: result.total, details: result.details });
                
            } catch (err) {
                self.postMessage({ success: false, error: err.message });
            }
        };
    `;

    const blob = new Blob([workerLogic], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    // Increased timeout to 5 seconds because Pyodide can take 1-2 seconds to load on first click
    const timeout = setTimeout(() => {
        worker.terminate(); 
        executionRecord.status = "timeout";
        executionRecord.errorMsg = "Execution timed out (Possible infinite loop).";
        appendLog(consoleDiv, "[ERROR] Execution timed out.", "fail");
        sessionData.events.executions.push(executionRecord);
    }, 5000); 

    worker.onmessage = function(e) {
        clearTimeout(timeout); 
        const data = e.data;

        if (data.success) {
            executionRecord.status = "success";
            executionRecord.testsPassed = data.passed;
            data.details.forEach(res => {
                const colorClass = res.status === "PASS" ? "pass" : "fail";
                appendLog(consoleDiv, `[\${res.status}] Test \${res.test}: expected "\${res.expected}", got "\${res.got}"`, colorClass);
            });
            appendLog(consoleDiv, `\\nTotal: \${data.passed}/\${data.total} tests passed.`, "normal");
        } else {
            executionRecord.status = "error";
            executionRecord.errorMsg = data.error;
            appendLog(consoleDiv, `[ERROR] \${data.error}`, "fail");
        }
        
        sessionData.events.executions.push(executionRecord);
        worker.terminate(); 
    };

    worker.postMessage({ code: userCode });
}

// 5. Safe HTML Logger
function appendLog(container, message, typeClass) {
    const span = document.createElement('span');
    span.textContent = message; 
    if (typeClass) span.className = typeClass;
    container.appendChild(span);
    container.appendChild(document.createElement('br'));
}

// 6. NEW: The Missing Export Function
async function exportData(finalCodeText) {
    sessionData.metadata.endTime = Date.now();
    sessionData.finalCode = finalCodeText;

    // Change this to your live server URL later
    const SERVER_URL = "http://localhost:5000/api/submit-telemetry"; 

    try {
        const response = await fetch(SERVER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(sessionData)
        });

        if (response.ok) {
            alert("Submission complete! Data securely sent to the research server.");
        } else {
            console.error("Server responded with an error:", response.status);
            alert("Failed to send data. Please check your connection.");
        }
    } catch (error) {
        console.error("Network error:", error);
        alert("Could not connect to the server. (Make sure your Flask server is running!)");
    }
}