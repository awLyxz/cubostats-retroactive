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

    // Generate the master function file content
    let masterFunctionContent = "";

    // Process each JSON file
    for (const file of jsonFiles) {
      const json = JSON.parse(await file.text());
      const uuid = file.name.replace('.json', '');

      // Check UUID length before attempting to fetch username
      if (uuid.length !== 36) {
        failedFiles.push(file.name);
        continue;
      }

      const playerData = await fetchPlayerData(uuid);

      if (playerData) {
        const { username, avatar } = playerData;

        masterFunctionContent += `execute if entity @s[name=${username}] run function cubostats:old_data/stats_${username.toLowerCase()}\n`;

        const mcfunctionContent = generateMcfunctionContent(json, mapping, username);
        mcfunctionFiles.push({
          filename: `stats_${username.toLowerCase()}.mcfunction`,
          content: mcfunctionContent,
          avatar: avatar // Attach avatar URL for display later
        });
      } else {
        failedFiles.push(file.name);
      }
    }

    // Add it to the list of files to be zipped
    mcfunctionFiles.push({ filename: 'update_all_stats.mcfunction', content: masterFunctionContent });

    const zipBlob = await createZip(mcfunctionFiles);

    // Show the result section with filenames, failed files, and the download button
    displayResult(mcfunctionFiles, zipBlob, failedFiles);

    statusDiv.textContent = '';
  } catch (error) {
    console.error(error);
    statusDiv.textContent = '';
  }
});

function adjustTopTextMargin() {
  const fixedLinks = document.querySelector('.links');
  const topText = document.getElementById('top-text');
  if (!fixedLinks || !topText) return;

  if (window.innerWidth < 1150) {
    const linksHeight = fixedLinks.offsetHeight;
    topText.style.marginTop = linksHeight + 40 + 'px';
  } else {
    topText.style.marginTop = '40px';
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("json-files");
  const addFilesButton = document.getElementById("add-files-button");
  const fileStatus = document.getElementById("file-status");
  const dropZone = document.getElementById("drop-zone");
  const convertButton = document.getElementById("convert-grayed");

  adjustTopTextMargin();
  window.addEventListener('resize', adjustTopTextMargin);

  // Click button to open file selector
  addFilesButton.addEventListener("click", () => {
    fileInput.click();
  });

  // Handle file input change
  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
  });

  // Drag and drop functionality
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#fff';
      dropZone.style.backgroundColor = '#333';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#ccc';
      dropZone.style.backgroundColor = '#1a1a1a';
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '#ccc';

  const files = Array.from(e.dataTransfer.files);
  const jsonFiles = files.filter(file => file.type === "application/json" || file.name.endsWith(".json"));

  if (jsonFiles.length === 0) {
    fileStatus.textContent = "Only .json files are allowed.";
    convertButton.id = "convert-grayed";
    return;
  }

  // Optional: to reflect selected files in the input field
  const dataTransfer = new DataTransfer();
  jsonFiles.forEach(file => dataTransfer.items.add(file));
  fileInput.files = dataTransfer.files;

  handleFiles(jsonFiles);
  });

  // Common handler for updating UI and enabling the convert button
  function handleFiles(files) {
    const fileCount = files.length;
    fileStatus.textContent = fileCount > 0
      ? `${fileCount} file${fileCount > 1 ? 's' : ''} selected.`
      : "No files selected.";

    if (fileCount > 0) {
      convertButton.id = "convert";
    } else {
      convertButton.id = "convert-grayed";
    }
  }

  const downloadAdvancementBtn = document.getElementById('download-advancement-btn');
downloadAdvancementBtn.addEventListener('click', function () {
  fetch('https://raw.githubusercontent.com/awLyxz/cubostats-retroactive/main/retroactive_stats_update.json')
    .then(response => response.blob())
    .then(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'retroactive_stats_update.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    })
    .catch(console.error);
});

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

async function fetchPlayerData(uuid) {
  const url = `https://playerdb.co/api/player/minecraft/${uuid}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.success) {
    return {
      username: data.data.player.username,
      avatar: data.data.player.avatar
    };
  } else {
    return null;
  }
}

function generateMcfunctionContent(json, mapping, username) {
  let content = 'tellraw @s [{"text":"Cubo","color":"dark_green"},{"text":"Stats","color":"red"},{"text":" was Retroactively Updated","color":"gold"}]\n\n';
  const stats = json.stats || {};

  for (const category in stats) {
    const formattedCategory = category.replace(':', '.');
    const categoryStats = stats[category];

    for (const stat in categoryStats) {
      const fullStat = `${formattedCategory}:${stat.replace(':', '.')}`;
      if (mapping[fullStat]) {
        content += `scoreboard players set @s ${mapping[fullStat]} ${categoryStats[stat]}\n`;
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
    if (!file.filename.includes('update_all_stats')) {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '8px';

      if (file.avatar) {
        const img = document.createElement('img');
        img.src = file.avatar;
        img.classList.add('avatar-img');
        li.appendChild(img);
      }

      const text = document.createElement('span');
      text.textContent = file.filename;
      li.appendChild(text);

      fileList.appendChild(li);
    }
  });

  const failedFileListContainer = document.getElementById('has-failed-file');
  const failedFileList = document.getElementById('failed-file-list');

  // Clear previous entries
  while (failedFileList.firstChild) {
    failedFileList.removeChild(failedFileList.firstChild);
  }

  if (failedFiles.length > 0) {
    failedFileListContainer.style.display = 'inline-block';
    failedFiles.forEach(fileName => {
      const li = document.createElement('li');
      li.textContent = fileName;
      failedFileList.appendChild(li);
    });
  } else {
    failedFileListContainer.style.display = 'none';
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
  });;
}
