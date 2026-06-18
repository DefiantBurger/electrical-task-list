try {
  require('dotenv').config(); // for local development, loads .env file
} catch (e) {
  // Running on GitHub Actions, dotenv isn't needed here
}
const fs = require('fs');

const LIST_ID = process.env.CLICKUP_ELECTRICAL_TASK_LIST_ID;
const API_TOKEN = process.env.CLICKUP_API_TOKEN;

if (!API_TOKEN) {
  console.error("❌ Error: CLICKUP_API_TOKEN is missing. Check your .env file!");
  process.exit(1);
}

if (!LIST_ID) {
  console.error("❌ Error: CLICKUP_ELECTRICAL_TASK_LIST_ID is missing. Check your .env file!");
  process.exit(1);
}

async function fetchTasks() {
  console.log("Fetching data from ClickUp...");
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${LIST_ID}/task`, {
      headers: { 'Authorization': API_TOKEN }
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    generateHTML(data.tasks || []);
  } catch (error) {
    console.error("❌ Error fetching data from ClickUp:", error.message);
    process.exit(1);
  }
}

function generateHTML(tasks) {
  // 1. Generate List View Rows
  const listRowsHTML = tasks.map(task => `
    <tr class="border-b border-gray-100 hover:bg-gray-50 transition">
      <td class="py-3 px-4 font-medium text-gray-800">${task.name}</td>
      <td class="py-3 px-4">
        <span class="inline-block px-2 py-1 text-xs font-semibold rounded text-white" style="background-color: ${task.status.color}">
          ${task.status.status.toUpperCase()}
        </span>
      </td>
      <td class="py-3 px-4 text-sm text-gray-500">${task.assignees?.map(a => a.username).join(', ') || 'Unassigned'}</td>
      <td class="py-3 px-4 text-right">
        <a href="${task.url}" target="_blank" class="text-blue-600 hover:underline text-sm font-medium">Open ↗</a>
      </td>
    </tr>
  `).join('');

  // 2. Group by status for Board View
  const statusGroups = {};
  tasks.forEach(task => {
    const statusName = task.status.status;
    if (!statusGroups[statusName]) {
      statusGroups[statusName] = { name: statusName, color: task.status.color, tasks: [] };
    }
    statusGroups[statusName].tasks.push(task);
  });

  // Generate Board Columns
  const boardColumnsHTML = Object.values(statusGroups).map(group => `
    <div class="flex-1 min-w-[280px] bg-gray-50 p-4 rounded-lg flex flex-col gap-3">
      <div class="flex items-center gap-2 pb-2 border-b-2" style="border-color: ${group.color}">
        <span class="w-2 h-2 rounded-full" style="background-color: ${group.color}"></span>
        <h3 class="font-bold text-gray-700 text-sm uppercase tracking-wider">${group.name}</h3>
        <span class="ml-auto bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-bold">${group.tasks.length}</span>
      </div>
      <div class="flex flex-col gap-3 overflow-y-auto max-h-[600px]">
        ${group.tasks.map(task => `
          <div class="bg-white p-4 rounded-md shadow-sm border border-gray-200 hover:shadow-md transition flex flex-col gap-2">
            <h4 class="font-medium text-gray-800 text-sm">${task.name}</h4>
            <div class="flex items-center justify-between mt-2">
              <span class="text-xs text-gray-400">${task.assignees?.[0]?.username || '👤 Unassigned'}</span>
              <a href="${task.url}" target="_blank" class="text-xs text-blue-500 font-semibold hover:underline">View</a>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // 3. Assemble Complete Dashboard Template
  const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Electrical Task List</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen text-gray-800">

    <nav class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-3">
            <div class="bg-yellow-600 text-white p-2 rounded-lg font-bold text-lg leading-none">
              ⚡
            </div>
            <div>
                <h1 class="text-xl font-bold tracking-tight">Electrical Task List</h1>
                <p class="text-xs text-gray-400">Synced: ${new Date().toLocaleString()}</p>
            </div>
        </div>
        
        <div class="bg-gray-100 p-1 rounded-lg flex gap-1">
            <button id="btn-list" onclick="setView('list')" class="px-4 py-1.5 rounded-md text-sm font-medium transition shadow-sm bg-white text-gray-800">
                📝 List View
            </button>
            <button id="btn-board" onclick="setView('board')" class="px-4 py-1.5 rounded-md text-sm font-medium transition text-gray-500 hover:text-gray-800">
                📋 Board View
            </button>
        </div>
    </nav>

    <main class="p-6 max-w-7xl mx-auto">
        
        <div id="view-list" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th class="py-3 px-4">Task Name</th>
                        <th class="py-3 px-4">Status</th>
                        <th class="py-3 px-4">Assignee</th>
                        <th class="py-3 px-4 text-right">Link</th>
                    </tr>
                </thead>
                <tbody>
                    ${listRowsHTML || '<tr><td colspan="4" class="p-8 text-center text-gray-400">No tasks found.</td></tr>'}
                </tbody>
            </table>
        </div>

        <div id="view-board" class="hidden flex gap-4 overflow-x-auto items-start pb-4">
            ${boardColumnsHTML || '<div class="text-center w-full text-gray-400 py-12">No tasks organized into columns.</div>'}
        </div>

    </main>

    <script>
        function setView(viewType) {
            const listContainer = document.getElementById('view-list');
            const boardContainer = document.getElementById('view-board');
            const btnList = document.getElementById('btn-list');
            const btnBoard = document.getElementById('btn-board');

            if (viewType === 'list') {
                listContainer.classList.remove('hidden');
                boardContainer.classList.add('hidden');
                
                btnList.className = "px-4 py-1.5 rounded-md text-sm font-medium transition shadow-sm bg-white text-gray-800";
                btnBoard.className = "px-4 py-1.5 rounded-md text-sm font-medium transition text-gray-500 hover:text-gray-800";
            } else {
                listContainer.classList.add('hidden');
                boardContainer.classList.remove('hidden');

                btnList.className = "px-4 py-1.5 rounded-md text-sm font-medium transition text-gray-500 hover:text-gray-800";
                btnBoard.className = "px-4 py-1.5 rounded-md text-sm font-medium transition shadow-sm bg-white text-gray-800";
            }
        }
    </script>
</body>
</html>
  `;

  fs.writeFileSync('index.html', fullHTML);
  console.log('✅ Successfully generated index.html locally!');
}

fetchTasks();