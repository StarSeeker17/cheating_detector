// 1. Initialize the Telemetry Data Structure
const sessionData = {
    metadata: {
        startTime: Date.now(),
        endTime: null,
        userAgent: navigator.userAgent
    },
    events: {
        keystrokes: [],     // Used later to calculate Flight Time
        pastes: [],         // Captures massive code injections
        focusChanges: []    // Captures tab switching
    },
    finalCode: ""
};

// 2. Configure and Load Monaco Editor
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});

require(['vs/editor/editor.main'], function() {
    const editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: '// Write your solution here...\n\nfunction solveProblem() {\n\t\n}',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true
    });

    // Attach listeners once the editor is ready
    attachTelemetryListeners(editor);
});

// 3. Attach Telemetry Listeners
function attachTelemetryListeners(editor) {
    
    // A. Keystrokes (For Flight Time)
    // We only need keydown to measure the time between consecutive presses.
    editor.onKeyDown((e) => {
        sessionData.events.keystrokes.push({
            key: e.browserEvent.key,
            timestamp: Date.now()
        });
    });

    // B. Paste Events (Tracking the volume of injected code)
    editor.onDidPaste((e) => {
        // Monaco provides the 'range' of the pasted text. 
        // We use that to get the actual text and count the characters.
        const pastedText = editor.getModel().getValueInRange(e.range);
        
        sessionData.events.pastes.push({
            timestamp: Date.now(),
            characterCount: pastedText.length,
            // Storing a tiny snippet helps verify what was pasted without bloating your JSON
            snippet: pastedText.substring(0, 15).replace(/\n/g, "\\n") + "..." 
        });
    });

    // C. Browser Context (Tab Switching / Window Focus)
    window.addEventListener('blur', () => {
        sessionData.events.focusChanges.push({
            state: 'lost_focus', // They left the test tab
            timestamp: Date.now()
        });
    });

    window.addEventListener('focus', () => {
        sessionData.events.focusChanges.push({
            state: 'gained_focus', // They returned to the test tab
            timestamp: Date.now()
        });
    });

    // D. Handle Final Submission
    document.getElementById('submit-btn').addEventListener('click', () => {
        exportData(editor.getValue());
    });
}

// 4. Send the Data to Your Server
async function exportData(finalCodeText) {
    sessionData.metadata.endTime = Date.now();
    sessionData.finalCode = finalCodeText;

    // Change this to your server's URL once it's hosted online
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
        alert("Could not connect to the server.");
    }
}