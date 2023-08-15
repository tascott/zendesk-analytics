let devURL = 'http://localhost:5501/index.html'
let prodURL = 'https://tascott.co.uk/zendesk-analytics/'

function init() {
	var url = window.location.href;
	if (url.indexOf(devURL) !== -1) {
		if (url.indexOf('access_token=') !== -1) {
			var access_token = readUrlParam(url, 'access_token');
			localStorage.setItem('zauth', access_token);
			window.location.hash = '';
		}

		if (url.indexOf('error=') !== -1) {
			var error_desc = readUrlParam(url, 'error_description');
			var msg = 'Authorization error: ' + error_desc;
			displayError(msg);
		}
	}
}

async function makeRequestForAll(token, endpoint) { //Get all the data possible
	let items = [];
	let url = `https://encore-us.zendesk.com/api/v2/help_center/${endpoint}`;

	while (url) {
		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});

		if (!response.ok) {
			throw new Error(
				`Error fetching ${endpoint}: ${response.status} ${response.statusText}`
			);
		}

		const data = await response.json();
		items = items.concat(data[endpoint.slice(0, -5)]); // Remove ".json" and pluralize the key
		url = data.next_page;
	}
	return items;
}

// Helper functions
function startAuthFlow() {
	var endpoint = 'https://encore-us.zendesk.com/oauth/authorizations/new';
	var url_params =
		'?' + 'response_type=token' + '&' + 'redirect_uri=' + devURL + '&' + 'client_id=advanced-analytics' + '&' + 'scope=' + encodeURIComponent('read write');
	window.location = endpoint + url_params;
}

function displayError(message) {
	const errorMsgDiv = document.getElementById('error-msg');
	errorMsgDiv.innerHTML = `<p>${message}</p>`;
	errorMsgDiv.style.display = 'block';
}

function readUrlParam(url, param) {
	param += '=';
	if (url.indexOf(param) !== -1) {
		var start = url.indexOf(param) + param.length;
		var value = url.substr(start);
		if (value.indexOf('&') !== -1) {
			var end = value.indexOf('&');
			value = value.substring(0, end);
		}
		return value;
	} else {
		return false;
	}
}

// Helper function to get section and its ancestors up to 6 levels
function getSectionAncestors(sections, sectionId, level = 1) {
	const section = sections.find((sec) => sec.id === sectionId);
	if (section && section.parent_section_id && level < 6) {
		return [
			section,
			...getSectionAncestors(
				sections,
				section.parent_section_id,
				level + 1
			),
		];
	} else {
		return [section];
	}
}

// Modified createSectionMapping function
function createSectionMapping(sections, categories) {
	const sectionMapping = {};

	sections.forEach((section) => {
		const categoryId = section.category_id;
		const category = categories.find((cat) => cat.id === categoryId);
		const parentSections = getSectionAncestors(
			sections,
			section.parent_section_id
		);
		parentSections.unshift(section); // Add the current section to the parentSections array

		sectionMapping[section.id] = {
			category: category,
			parentSections: parentSections,
		};
	});

	// Example: Find section with ID 4407836762771
	// const section = sections.find((sec) => sec.id === 4407836762771);

	return sectionMapping;
}

function buildTable(articles, sectionMapping) {
    const tableBody = document.getElementById('table-body');

    for (const article of articles) {
        const sectionId = article.section_id;
        const sectionData = sectionMapping[sectionId];
        const { category, parentSections } = sectionData;

        const tableRow = document.createElement('tr');
		tableRow.setAttribute('data-category-name', category.name);

        // Category cell with position and data-category attributes
        const categoryCell = document.createElement('td');
        categoryCell.innerText = `${category.name}`;
        categoryCell.setAttribute('data-position', category.position);
        categoryCell.setAttribute('data-category', category.name);  // Add the data-category attribute
        tableRow.appendChild(categoryCell);

        // Parent Section cells with position and data-section attributes
        const maxParentSections = 6;
        const reversedParentSections = [...parentSections].reverse();
        for (let i = 0; i < maxParentSections; i++) {
            const parentSectionCell = document.createElement('td');
            if (reversedParentSections[i]) {
                parentSectionCell.innerText = `${reversedParentSections[i].name}`;
                parentSectionCell.setAttribute('data-position', reversedParentSections[i].position);
                parentSectionCell.setAttribute('data-section', reversedParentSections[i].name); // Add the data-section attribute
            } else {
                parentSectionCell.innerText = '';
                parentSectionCell.setAttribute('data-section', ''); // Blank section cell with data-section attribute
            }
            tableRow.appendChild(parentSectionCell);
        }

        // Article name cell with position and data-name attributes
        const articleCell = document.createElement('td');
        articleCell.innerText = `${article.title}`;
        articleCell.setAttribute('data-position', article.position);
        articleCell.setAttribute('data-name', article.title); // Add the data-name attribute
        tableRow.appendChild(articleCell);

        // Add article ID cell (no changes here)
        const articleIdCell = document.createElement('td');
        articleIdCell.innerText = article.id;
		articleIdCell.setAttribute('data-id', article.id);
        tableRow.appendChild(articleIdCell);

        tableBody.appendChild(tableRow);
    }
}


function shiftSectionCells() {
    const tableBody = document.getElementById('table-body');
    const rows = Array.from(tableBody.getElementsByTagName('tr'));

    for (const row of rows) {
        const sectionCells = Array.from(row.children).slice(1, 7); // Get section cells only

        for (let i = 0; i < sectionCells.length - 1; i++) {
            if (sectionCells[i].innerText === '') {
                for (let j = i; j < sectionCells.length - 1; j++) {
                    // Shift innerText
                    sectionCells[j].innerText = sectionCells[j + 1].innerText;
                    sectionCells[j + 1].innerText = '';

                    // Shift data-position
                    sectionCells[j].setAttribute('data-position', sectionCells[j + 1].getAttribute('data-position') || '');
                    sectionCells[j + 1].removeAttribute('data-position');

                    // Shift data-category (only if it exists)
                    if (sectionCells[j + 1].hasAttribute('data-category')) {
                        sectionCells[j].setAttribute('data-category', sectionCells[j + 1].getAttribute('data-category'));
                        sectionCells[j + 1].removeAttribute('data-category');
                    }

                    // Shift data-section
                    sectionCells[j].setAttribute('data-section', sectionCells[j + 1].getAttribute('data-section') || '');
                    sectionCells[j + 1].removeAttribute('data-section');

                    // Shift data-name (only if it exists)
                    if (sectionCells[j + 1].hasAttribute('data-name')) {
                        sectionCells[j].setAttribute('data-name', sectionCells[j + 1].getAttribute('data-name'));
                        sectionCells[j + 1].removeAttribute('data-name');
                    }
                }
            }
        }
    }
}

async function fetchAllDataAndCreateMapping() {
	let access_token = localStorage.getItem('zauth');

	if (!access_token) {
		console.log('No access token found, starting auth flow');
		startAuthFlow();
		return; // Don't proceed with data fetching.
	}

	try {
		const articlesPromise = makeRequestForAll(access_token, 'articles.json');
		const sectionsPromise = makeRequestForAll(access_token, 'sections.json');
		const categoriesPromise = makeRequestForAll(access_token, 'categories.json');

		const [articles, sections, categories] = await Promise.all([articlesPromise, sectionsPromise, categoriesPromise,]);

		const allData = {articles, sections, categories,};
		console.log('All data fetched:', allData);

		// Step 2: Create the section mapping
		const sectionMapping = createSectionMapping(sections, categories);

		// Sort articles based on the position of their categories
		articles.sort((a, b) => {
			const categoryA = sectionMapping[a.section_id].category;
			const categoryB = sectionMapping[b.section_id].category;
			return categoryA.position - categoryB.position;
		});

		return { articles, sectionMapping }; // Add this line to return the necessary data
	} catch (error) {
		displayError(error);
	}
}

function showSpinner() {
	document.getElementById('spinner').style.display = 'block';
	document.getElementById('table').style.display = 'none';
}

function hideSpinner() {
	document.getElementById('spinner').style.display = 'none';
	document.getElementById('table').style.display = 'table';
}

function downloadCSV() {
	const table = document.getElementById('table');
	const headerRows = Array.from(
		table.getElementsByTagName('thead')[0].getElementsByTagName('tr')
	);
	const bodyRows = Array.from(
		table.getElementsByTagName('tbody')[0].getElementsByTagName('tr')
	);
	const allRows = headerRows.concat(bodyRows);

	const csvContent = allRows
		.map((row) => {
			const headerCells = Array.from(row.getElementsByTagName('th'));
			const bodyCells = Array.from(row.getElementsByTagName('td'));
			const allCells = headerCells.concat(bodyCells);
			return allCells
				.map((cell) => `"${cell.innerText.replace(/"/g, '""')}"`)
				.join(',');
		})
		.join('\r\n');

	const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	const url = URL.createObjectURL(csvBlob);
	link.setAttribute('href', url);
	link.setAttribute('download', 'table_data.csv');
	link.style.display = 'none';
	document.body.appendChild(link);

	link.click();

	document.body.removeChild(link);
}

function copyTableToClipboard() {
    const table = document.querySelector('#table');
    if (!table) {
        console.error('Table not found');
        return;
    }

    // Generate a string representation of the table
    let tableString = '<table>';
    const rows = table.querySelectorAll('tr');
    for (const row of rows) {
        tableString += '<tr>';
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
            const position = cell.getAttribute('data-position');
            tableString += `<td data-position="${position || ''}">${cell.innerText}</td>`;
        }
        tableString += '</tr>';
    }
    tableString += '</table>';

    // Use the Clipboard API to write to clipboard
    try {
        navigator.clipboard.writeText(tableString).then(function() {
            console.log('Table data copied to clipboard');
        }, function(err) {
            console.error('Failed to copy table data:', err);
        });
    } catch (err) {
        console.error('Failed to copy table data:', err);
    }
}

// Event Listeners
document
	.getElementById('fetch-all-data')
	.addEventListener('click', async () => {
		showSpinner();

		try {
			const { articles, sectionMapping } =
				await fetchAllDataAndCreateMapping();
			buildTable(articles, sectionMapping);
			shiftSectionCells();
			addBorder()
			console.log('Table built', articles, sectionMapping);
		} catch (error) {
			displayError('Error fetching data and building table:', error);
		} finally {
			hideSpinner();
		}
	});

document
	.getElementById('copy-table')
	.addEventListener('click', copyTableToClipboard);

document.getElementById('reorganise').addEventListener('click', reorganizeTable);

window.addEventListener('load', init, false);



//Stopgap function for sorting
function reorganizeTable() {
    const table = document.querySelector('table');
    if (!table) {
        console.error('Table not found');
        return;
    }

    const rows = Array.from(table.querySelectorAll('tr:not(:first-child)'));

    const sortedRows = rows.sort((a, b) => {
        const aCells = a.querySelectorAll('td');
        const bCells = b.querySelectorAll('td');

        // Compare first column (category)
        const aPosition = parseInt(aCells[0].getAttribute('data-position') || "-1", 10);
        const bPosition = parseInt(bCells[0].getAttribute('data-position') || "-1", 10);

        if (aPosition !== bPosition) return aPosition - bPosition;

        // If they're equal, move on to the section columns
        for (let i = 1; i <= 6; i++) {
            const aSectionPosition = parseInt(aCells[i].getAttribute('data-position') || "-1", 10);
            const bSectionPosition = parseInt(bCells[i].getAttribute('data-position') || "-1", 10);

            if (aSectionPosition !== bSectionPosition) return aSectionPosition - bSectionPosition;
        }

        return 0;
    });

    // Append the sorted rows back to the table (this will just rearrange their order without deleting any)
    sortedRows.forEach(row => table.appendChild(row));

	addBorder();
}

document.addEventListener("DOMContentLoaded", function() {
    const checkbox = document.querySelector('.switch input[type="checkbox"]');

    checkbox.addEventListener('change', function() {
        if (this.checked) {
            showPositionNumbers();
        } else {
            hidePositionNumbers();
        }
    });
});

function showPositionNumbers() {
    const cells = document.querySelectorAll('[data-position]');
    cells.forEach(cell => {
        const position = cell.getAttribute('data-position');
        if (position && position !== "-1") {
            cell.textContent += ` (Position: ${position})`;
        }
    });
}

function hidePositionNumbers() {
    const cells = document.querySelectorAll('[data-position]');
    cells.forEach(cell => {
        cell.textContent = cell.textContent.replace(/ \(Position: \d+\)/, "");
    });
}

function addBorder() {
	const rows = document.querySelectorAll('tr[data-category-name]');

	rows.forEach(row => {
		row.style.borderTop = "1px solid black";
	});

	let previousCategoryName = null;

	rows.forEach(row => {
		const currentCategoryName = row.getAttribute('data-category-name');

		if (previousCategoryName !== currentCategoryName) {
			row.style.borderTop = "3px solid black";
			previousCategoryName = currentCategoryName;
		}
	});
}
