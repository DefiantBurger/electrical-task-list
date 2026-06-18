try {
	require("dotenv").config(); // for local development, loads .env file
} catch (e) {
	// Running on GitHub Actions, dotenv isn't needed here
}
const fs = require("fs");

const LIST_ID = process.env.CLICKUP_ELECTRICAL_TASK_LIST_ID;
const API_TOKEN = process.env.CLICKUP_API_TOKEN;

if (!API_TOKEN) {
	console.error(
		"❌ Error: CLICKUP_API_TOKEN is missing. Check your .env file!",
	);
	process.exit(1);
}

if (!LIST_ID) {
	console.error(
		"❌ Error: CLICKUP_ELECTRICAL_TASK_LIST_ID is missing. Check your .env file!",
	);
	process.exit(1);
}

async function fetchTasks() {
	console.log("Fetching data from ClickUp...");
	try {
		const response = await fetch(
			`https://api.clickup.com/api/v2/list/${LIST_ID}/task?include_closed=true`,
			{
				headers: { Authorization: API_TOKEN },
			},
		);

		if (!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);

		const data = await response.json();
    console.log(`✅ Fetched ${data.tasks.length} tasks from ClickUp!`);
		generateHTML(data.tasks || []);
	} catch (error) {
		console.error("❌ Error fetching data from ClickUp:", error.message);
		process.exit(1);
	}
}

function generateHTML(tasks) {
  // 1. Structure the raw data into clean objects for Grid.js and the Board
  const structuredTasks = tasks.map(task => ({
    id: task.id,
    name: task.name,
    status: task.status.status.toUpperCase(),
    statusColor: task.status.color,
    assignee: task.assignees?.map(a => a.username).join(', ') || 'Unassigned',
    description: task.text_content || '',
    url: task.url,
    dueDate: task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : '—'
  }));

  const predefinedColumns = [
    { name: 'POSSIBLE', color: '#f87171' },
    { name: 'PLANNED', color: '#fbbf24' },
    { name: 'IN PROGRESS', color: '#60a5fa' },
    { name: 'COMPLETE', color: '#34d399' }
  ];
  const uniqueStatuses = predefinedColumns.filter(col => structuredTasks.some(t => t.status === col.name));
  
  // 2. Generate pure HTML markup for the Board view columns
  const boardColumnsHTML = uniqueStatuses.map(column => {
    const columnTasks = structuredTasks.filter(t => t.status === column.name);
    
    return `
      <div class="w-72 bg-slate-100 flex flex-col rounded-lg border border-slate-200 h-full flex-shrink-0 shadow-sm overflow-hidden">
        <div class="flex items-center justify-between p-2.5 border-b bg-slate-50" style="border-bottom-color: ${column.color}; border-bottom-width: 2px;">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${column.color}"></span>
            <h3 class="font-bold text-slate-700 text-xs uppercase tracking-wider truncate">${column.name}</h3>
          </div>
          <span class="bg-slate-200 text-slate-600 text-[11px] px-1.5 py-0.5 rounded-full font-bold ml-2">${columnTasks.length}</span>
        </div>
        <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-2 bg-slate-50/50">
          ${columnTasks.map(task => `
            <div class="bg-white p-2.5 rounded border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col gap-1.5 text-xs">
              <h4 class="font-semibold text-slate-800 leading-tight">${task.name}</h4>
              <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-slate-400 text-[10px]">
                <span class="truncate max-w-[140px]">👤 ${task.assignee}</span>
                <span>📅 ${task.dueDate}</span>
              </div>
            </div>
          `).join('') || '<p class="text-[11px] text-slate-400 italic py-4 text-center">No tasks</p>'}
        </div>
      </div>
    `;
  }).join('');

  // 3. Complete standalone page template
  const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Club Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css" rel="stylesheet" />
    <style>
        /* Force Grid.js container layout to utilize flex full height internal scrolls */
        .gridjs-wrapper { box-shadow: none !important; border-radius: 0 !important; border: none !important; flex: 1 1 0% !important; overflow-y: auto !important; }
        .gridjs-container { height: 100% !important; display: flex !important; flex-direction: column !important; }
        .gridjs-footer { border-top: 1px solid #e2e8f0 !important; padding: 6px 12px !important; margin-top: auto; }
        .gridjs-head { padding: 8px 12px 4px 12px !important; }
    </style>
</head>
<body class="bg-slate-50 h-screen w-screen flex flex-col overflow-hidden text-slate-800">

    <nav class="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm flex-shrink-0 h-14">
        <div class="flex items-center gap-2">
            <div class="bg-yellow-600 text-white w-7 h-7 rounded-lg font-bold text-sm flex items-center justify-center shadow-sm">⚡</div>
            <div>
                <h1 class="text-sm font-bold text-slate-900 leading-tight tracking-tight">Club Projects</h1>
                <p class="text-[10px] text-slate-400">Synced: ${new Date().toLocaleString()}</p>
            </div>
        </div>
        
        <div class="bg-slate-100 p-0.5 rounded-md flex gap-0.5 border border-slate-200 text-xs">
            <button id="btn-list" onclick="setView('list')" class="px-3 py-1 rounded font-semibold transition shadow-sm bg-white text-slate-800">
                📝 List
            </button>
            <button id="btn-board" onclick="setView('board')" class="px-3 py-1 rounded font-semibold transition text-slate-500 hover:text-slate-800">
                📋 Board
            </button>
        </div>
    </nav>

    <main class="flex-1 w-full p-3 min-h-0 overflow-hidden relative">
        
        <div id="view-list" class="bg-white rounded-lg shadow-sm border border-slate-200 h-full w-full overflow-hidden flex flex-col"></div>

        <div id="view-board" class="hidden h-full w-full flex gap-3 overflow-x-auto items-start pb-1">
            ${boardColumnsHTML}
        </div>

    </main>

    <script src="https://cdn.jsdelivr.net/npm/gridjs/dist/gridjs.umd.js"></script>
    
    <script>
        const rawTaskData = ${JSON.stringify(structuredTasks)};

        const gridData = rawTaskData.map(task => [
            task.name,
            task.status,
            task.statusColor,
            task.assignee,
            task.dueDate,
            task.url
        ]);

        new gridjs.Grid({
            columns: [
                { name: 'Task Name', width: '40%' },
                { 
                    name: 'Status', 
                    width: '15%',
                    formatter: (cell, row) => {
                        const hexColor = row.cells[2].data;
                        return gridjs.html(\`<span class="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded text-white" style="background-color: \${hexColor}">\${cell}</span>\`);
                    }
                },
                { name: 'ColorValue', hidden: true },
                { name: 'Assignee', width: '18%' },
                { name: 'Due Date', width: '15%' },
            ],
            data: gridData,
            search: true,
            sort: true,
            pagination: {
                limit: 25 // Elevated row count to utilize larger table canvas area
            },
            className: {
                container: 'h-full flex flex-col',
                table: 'w-full border-collapse',
                thead: 'bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase sticky top-0 z-10',
                search: 'mb-2 text-xs',
                th: 'p-2 text-left font-semibold text-[11px] uppercase text-slate-500 tracking-wider',
                td: 'p-2 text-xs text-slate-700 border-b border-slate-100 font-medium'
            }
        }).render(document.getElementById("view-list"));

        function setView(viewType) {
            const listContainer = document.getElementById('view-list');
            const boardContainer = document.getElementById('view-board');
            const btnList = document.getElementById('btn-list');
            const btnBoard = document.getElementById('btn-board');

            if (viewType === 'list') {
                listContainer.classList.remove('hidden');
                boardContainer.classList.add('hidden');
                btnList.className = "px-3 py-1 rounded font-semibold transition shadow-sm bg-white text-slate-800";
                btnBoard.className = "px-3 py-1 rounded font-semibold transition text-slate-500 hover:text-slate-800";
                window.dispatchEvent(new Event('resize')); // Forces Grid.js table layout re-alignment calculations
            } else {
                listContainer.classList.add('hidden');
                boardContainer.classList.remove('hidden');
                btnList.className = "px-3 py-1 rounded font-semibold transition text-slate-500 hover:text-slate-800";
                btnBoard.className = "px-3 py-1 rounded font-semibold transition shadow-sm bg-white text-slate-800";
            }
        }
    </script>
</body>
</html>
  `;

  fs.writeFileSync('index.html', fullHTML);
  console.log('✅ Successfully generated tight, space-efficient full viewport layout!');
}

fetchTasks();