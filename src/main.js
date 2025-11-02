document.addEventListener('DOMContentLoaded', function (event) {
  let componentRelay
  let workingNote, clientData
  let lastValue, lastUUID
  let editor
  let ignoreTextChange = false
  let initialLoad = true

  function loadComponentRelay() {
    const initialPermissions = [{ name: 'stream-context-item' }]
    componentRelay = new ComponentRelay({
      initialPermissions,
      targetWindow: window,
      onReady: function () {
        const platform = componentRelay.platform
        if (platform) {
          document.body.classList.add(platform)
        }

        loadEditor()

        // only use CodeMirror selection color if we're not on mobile.
        editor.setOption('styleSelectedText', !componentRelay.isMobile)
      },
      handleRequestForContentHeight: () => {
        return undefined
      },
    })

    componentRelay.streamContextItem((note) => {
      onReceivedNote(note)
    })
  }

  function saveNote() {
    if (workingNote) {
      // Be sure to capture this object as a variable, as this.note may be reassigned in `streamContextItem`, so by the time
      // you modify it in the presave block, it may not be the same object anymore, so the presave values will not be applied to
      // the right object, and it will save incorrectly.
      let note = workingNote

      componentRelay.saveItemWithPresave(note, () => {
        lastValue = editor.getValue()
        note.content.text = lastValue
        note.clientData = clientData

        // clear previews
        note.content.preview_plain = null
        note.content.preview_html = null
      })
    }
  }

  function onReceivedNote(note) {
    if (note.uuid !== lastUUID) {
      // Note changed, reset last values
      lastValue = null
      initialLoad = true
      lastUUID = note.uuid
    }

    workingNote = note

    // Only update UI on non-metadata updates.
    if (note.isMetadataUpdate) {
      return
    }

    clientData = note.clientData

    if (editor) {
      if (note.content.text !== lastValue) {
        ignoreTextChange = true
        editor.getDoc().setValue(workingNote.content.text)
        ignoreTextChange = false
      }

      if (initialLoad) {
        initialLoad = false
        editor.getDoc().clearHistory()
      }

      editor.setOption('spellcheck', workingNote.content.spellcheck)
    }
  }

  function loadEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
      mode: 'gfm',
      lineWrapping: true,
      extraKeys: { 'Alt-F': 'findPersistent' },
      inputStyle: getInputStyleForEnvironment(),
    })
    editor.setSize(undefined, '100%')

    editor.on('change', function () {
      if (ignoreTextChange) {
        return
      }
      saveNote()
    })

    // editor.on("mousedown", function(cm, event) {
    //   if (!event.ctrlKey) return;
    //   event.preventDefault();
    //   const pos = cm.coordsChar({left: event.pageX, top: event.pageY});
    //   const token = cm.getTokenAt(pos);
    //   const urlRegex = /^(https?:\/\/[^\s]+|www\.[^\s]+)/;
    //   if (token.string.match(urlRegex)) {
    //       let url = token.string;
    //       if (!url.startsWith('https')) {
    //           url = 'https://' + url;
    //       }
    //       window.open(url, '_blank');
    //   }
    // });

    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.display = 'none';
    tooltip.style.background = '#fff';
    tooltip.style.border = '1px solid #ccc';
    tooltip.style.padding = '8px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    tooltip.style.zIndex = '1000';
    tooltip.style.maxWidth = '300px';
    document.body.appendChild(tooltip);

    function fullUrl(pos) {
        const cm = editor;
        const token = cm.getTokenAt(pos);

        if (token.type && token.type.includes('link')) {
            let url = token.string;
            
            // Get the full line to extract complete URL
            const line = cm.getLine(pos.line);
            const tokenStart = token.start;
            const tokenEnd = token.end;
            
            // Expand to get full URL if token is partial
            let start = tokenStart;
            let end = tokenEnd;
            
            // Move backwards to find start of URL
            while (start > 0 && !/[\s\(\)\[\]<>]/.test(line[start - 1])) {
            start--;
            }
            
            // Move forwards to find end of URL
            while (end < line.length && !/[\s\(\)\[\]<>]/.test(line[end])) {
            end++;
            }
            
            url = line.substring(start, end);
            return url.startsWith('http') ? url : `https://${url}`;
        }
    }

    editor.on("mousedown", function(cm, event) {
        const pos = cm.coordsChar({left: event.pageX, top: event.pageY});
        const url = fullUrl(pos);
        if(!url) return;
        // Create clickable link
        tooltip.innerHTML = `
        <a href="${url}" rel="noopener noreferrer" 
            style="color: #0066cc; text-decoration: none;">
            ${url}
        </a>
        `;

        // Position tooltip
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 5) + 'px';
        tooltip.style.display = 'block';

        tooltip.onmouseleave = () => {
            tooltip.style.display = 'none';
        };
    });
  }

  function getInputStyleForEnvironment() {
    const environment = componentRelay.environment ?? 'web'
    return environment === 'mobile' ? 'textarea' : 'contenteditable'
  }

  loadComponentRelay()
})
