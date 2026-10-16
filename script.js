    document.getElementById('filePicker').addEventListener('change', handleFile);

    function log(message) {
      const logBox = document.getElementById('logBox');
      logBox.innerHTML += `<div>> ${message}</div>`;
      logBox.scrollTop = logBox.scrollHeight;
    }

    function handleFile(event) {
      const file = event.target.files[0];
      if (!file) return;

      const pruneValue = parseInt(document.getElementById('pruneThreshold').value, 10);
      const container = document.getElementById('statusContainer');
      const statusLabel = document.getElementById('statusLabel');
      const progressLabel = document.getElementById('progressLabel');
      const progressBar = document.getElementById('progressBar');
      const logBox = document.getElementById('logBox');

      container.style.display = 'block';
      logBox.innerHTML = '';
      statusLabel.textContent = 'Processing stream...';
      log('Target identified: ' + file.name);
      log('File size: ' + (file.size / (1024 * 1024)).toFixed(2) + ' MB');
      log('Trigram pruning threshold set to: ' + pruneValue);

      const bigramCounts = {};
      const trigramCounts = {};

      const reader = file.stream().getReader();
      const decoder = new TextDecoder('utf-8');

      let partialLine = '';
      let processedBytes = 0;
      const totalBytes = file.size;
      const startTime = Date.now();

      function readChunk() {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (partialLine.trim()) {
              processLine(partialLine.trim(), bigramCounts, trigramCounts);
            }
            log('Stream parsing complete.');
            finalizeDualMatrix(bigramCounts, trigramCounts, pruneValue, startTime);
            return;
          }

          processedBytes += value.byteLength;
          const currentPct = Math.round((processedBytes / totalBytes) * 100);

          progressLabel.textContent = currentPct + '%';
          progressBar.style.width = currentPct + '%';

          const chunkText = decoder.decode(value, { stream: true });
          const lines = (partialLine + chunkText).split(/\r?\n/);

          partialLine = lines.pop();

          for (let i = 0; i < lines.length; i++) {
            const password = lines[i].trim();
            if (password) processLine(password, bigramCounts, trigramCounts);
          }

          readChunk();
        });
      }

      readChunk();
    }

    function processLine(password, bigramCounts, trigramCounts) {
      const len = password.length;
      for (let i = 0; i < len; i++) {
        if (i < len - 1) {
          const char1 = password[i];
          const char2 = password[i + 1];
          if (!bigramCounts[char1]) bigramCounts[char1] = {};
          if (!bigramCounts[char1][char2]) bigramCounts[char1][char2] = 0;
          bigramCounts[char1][char2]++;
        }
        if (i < len - 2) {
          const historyState = password[i] + password[i + 1];
          const targetChar = password[i + 2];
          if (!trigramCounts[historyState]) trigramCounts[historyState] = {};
          if (!trigramCounts[historyState][targetChar]) trigramCounts[historyState][targetChar] = 0;
          trigramCounts[historyState][targetChar]++;
        }
      }
    }

    function finalizeDualMatrix(bigramCounts, trigramCounts, pruneValue, startTime) {
      document.getElementById('statusLabel').textContent = 'Pruning and Compressing payload...';


            //     // 1st-Order Matrix Calculation
      const bigramMatrix = {};
        for (const [currentChar, transitions] of Object.entries(bigramCounts)) {
        const total = Object.values(transitions).reduce((sum, val) => sum + val, 0);
        bigramMatrix[currentChar] = {};
        for (const [nextChar, count] of Object.entries(transitions)) {
          bigramMatrix[currentChar][nextChar] = Math.round((count / total) * 10000) / 10000;
        }
      }


            // 2nd-Order Matrix Calculation with Pruning
      log('Pruning rare structural noise configurations...');
      const trigramMatrix = {};
      let keptCount = 0;
      let prunedCount = 0;

      for (const [historyState, transitions] of Object.entries(trigramCounts)) {
        const filteredTransitions = {};
        let adjustedTotal = 0;

        for (const [targetChar, count] of Object.entries(transitions)) {
          if (count >= pruneValue) {
            filteredTransitions[targetChar] = count;
            adjustedTotal += count;
            keptCount++;
          } else {
            prunedCount++;
          }
        }

        // Only commit history states that retain surviving transitions
        if (adjustedTotal > 0) {
          trigramMatrix[historyState] = {};
          for (const [targetChar, count] of Object.entries(filteredTransitions)) {
            trigramMatrix[historyState][targetChar] = Math.round((count / adjustedTotal) * 10000) / 10000;
          }
        }
      }

      log(`Pruned ${prunedCount} rare transitions. Preserved ${keptCount} heavy pathways.`);


          log(`Pruned ${prunedCount} rare transitions. Preserved ${keptCount} heavy pathways.`);

          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          document.getElementById('statusLabel').textContent = 'Task Accomplished!';
          log('Compilation completed in ' + duration + 's');

          const finalPayload = {
            bigramModel: bigramMatrix,
            trigramModel: trigramMatrix
          };

          // Stringify tightly without whitespace formatting to save network payload weight
          const blob = new Blob([JSON.stringify(finalPayload)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);

          log(`Production output footprint size: ${(blob.size / 1024).toFixed(2)} KB`);

          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = 'trained_matrix_mill.json';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          downloadLink.remove();
          URL.revokeObjectURL(url);

          log('Optimized bundle file delivered.');
        }
        