document.getElementById('upload-form').addEventListener('submit', async function (event) {
  event.preventDefault();

  const button = document.getElementById('convert');
  button.style.opacity = '0.5';  // Fade to 50%

    // After 200ms, fade back to 100%
    setTimeout(() => {
      button.style.opacity = '1';
    }, 150);

  const jsonFiles = document.getElementById('json-files').files;
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Processing...';

  try {
    const mapping = await loadMapping();
    const mcfunctionFiles = [];
    const failedFiles = []; // To track failed files

    // Process each JSON file
    for (const file of jsonFiles) {
      const json = JSON.parse(await file.text());
      const uuid = file.name.replace('.json', '');
      const username = await fetchUsername(uuid);

      if (username) {
        const mcfunctionContent = generateMcfunctionContent(json, mapping, username);
        mcfunctionFiles.push({ filename: `stats_${username.toLowerCase()}.mcfunction`, content: mcfunctionContent });
      } else {
        failedFiles.push(file.name); // Track the failed file
      }
    }

    const zipBlob = await createZip(mcfunctionFiles);

    // Show the result section with filenames, failed files, and the download button
    displayResult(mcfunctionFiles, zipBlob, failedFiles);

    statusDiv.textContent = '';
  } catch (error) {
    console.error(error);
    statusDiv.textContent = '';
  }
});

async function loadMapping() {
  const response = await fetch('cubostats_mapping.txt');
  const text = await response.text();
  const mapping = {};
  text.split('\n').forEach(line => {
    const [scoreboard, stat] = line.trim().split(/\s+/);
    if (scoreboard && stat) {
      mapping[stat] = scoreboard;
    }
  });
  return mapping;
}

async function fetchUsername(uuid) {
  const url = `https://playerdb.co/api/player/minecraft/${uuid}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.success ? data.data.player.username : null;
}

function generateMcfunctionContent(json, mapping, username) {
  let content = '$tellraw $(output_name) [{"text":"Cubo","color":"dark_green"},{"text":"Stats","color":"red"},{"text":" was Retroactively Updated","color":"gold"}]\n';
  const stats = json.stats || {};

  for (const category in stats) {
    const formattedCategory = category.replace(':', '.');
    const categoryStats = stats[category];

    for (const stat in categoryStats) {
      const fullStat = `${formattedCategory}:${stat.replace(':', '.')}`;
      if (mapping[fullStat]) {
        content += `scoreboard players set ${username} ${mapping[fullStat]} ${categoryStats[stat]}\n`;
      }
    }
  }

  return content;
}

async function createZip(files) {
  const zip = new JSZip();
  files.forEach(file => {
    zip.file(file.filename, file.content);
  });
  return zip.generateAsync({ type: 'blob' });
}

function displayResult(mcfunctionFiles, zipBlob, failedFiles) {
  // Hide the initial form and status
  // document.getElementById('upload-form').style.display = 'none';
  // document.getElementById('status').style.display = 'none';

  // Removes elements from the file list
  const ulFileListElement = document.getElementById("file-list");
  if (ulFileListElement) {
    const liElements = ulFileListElement.getElementsByTagName("li");
    while (liElements.length > 0) {
      ulFileListElement.removeChild(liElements[0]);
    }
  }

  // Removes elements from the failed file list
  const ulFailedFileListElement = document.getElementById("failed-file-list");
  if (ulFailedFileListElement) {
    const liElements = ulFailedFileListElement.getElementsByTagName("li");
    while (liElements.length > 0) {
      ulFailedFileListElement.removeChild(liElements[0]);
    }
  }


  // Show the result section
  const resultSection = document.getElementById('result-section');
  resultSection.style.display = 'block';

  // Add filenames to the file list
  const fileList = document.getElementById('file-list');
  mcfunctionFiles.forEach(file => {
    const li = document.createElement('li');
    li.textContent = file.filename;
    fileList.appendChild(li);
  });

  // Display failed files
  const failedFileList = document.getElementById('failed-file-list');
  if (failedFiles.length > 0) {
    failedFiles.forEach(fileName => {
      const li = document.createElement('li');
      li.textContent = fileName;
      failedFileList.appendChild(li);
    });
  }

  const downloadZipButton = document.getElementById('download-zip-btn');

  // Remove any existing event listeners
  const newButton = downloadZipButton.cloneNode(true);
  downloadZipButton.parentNode.replaceChild(newButton, downloadZipButton);

  newButton.addEventListener('click', function() {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = 'cubostats-retroactive-stats.zip';
    link.click();
  })

  const downloadAdvancementButton = document.getElementById('download-advancement-btn');

  downloadAdvancementButton.addEventListener('click', function() {
    // Path to the existing file
    const filePath = './retroactive_stats_update.json'; // Change this if needed

    // Create a temporary download link
    const link = document.createElement('a');
    link.href = filePath;
    link.download = 'retroactive_stats_update.json'; // Ensure the file name is the same or change it

    // Trigger the download by clicking the link programmatically
    link.click();
  });
}
