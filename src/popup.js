console.log('script loaded');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded');
    document.getElementById('toggleHighlight').addEventListener('click', () => {
        console.log('toggleHighlight clicked');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "toggleHighlight" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError.message);
                    } else {
                        console.log("Message sent successfully");
                    }
                });
            }
        });
    });

    document.getElementById('clearHighlights').addEventListener('click', () => {
        console.log('clearHighlights clicked');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "clearHighlights" });
        });
    });
});