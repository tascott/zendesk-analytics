let devURL = 'http://localhost:5501/index.html'
let prodURL = 'https://tascott.co.uk/zendesk-analytics/'
let noApiCalls = 0;
let table1APIdata;
let table2csvData;
let userSegments = [];
let combinedData = [];
let combinedTableData = [];

console.log('Script loaded 4')

function init() {
	var url = window.location.href;
	if(url.indexOf(prodURL) !== -1) {
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
		noApiCalls++;
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

async function getSegmentNames(IDlist) {
	let url = `https://encore-us.zendesk.com/api/v2/help_center/user_segments/`;
	let access_token = localStorage.getItem('zauth');
	let fetchPromises = [];

	IDlist.forEach(id => {
		noApiCalls++; // Increment API call count
		const fetchPromise = fetch(url + id,{
			headers: {Authorization: `Bearer ${access_token}`},
		}).then(response => {
			if(!response.ok) {
				throw new Error(`Error fetching user segment ${id}: ${response.status} ${response.statusText}`);
			}
			return response.json();
		}).then(data => {
			userSegments.push({user_segment_id: data.user_segment.id,name: data.user_segment.name, user_segment_user_type: data.user_segment.user_type});
		});

		fetchPromises.push(fetchPromise);
	});

	await Promise.all(fetchPromises);
	return userSegments;
}

// Helper functions
function startAuthFlow() {
	var endpoint = 'https://encore-us.zendesk.com/oauth/authorizations/new';
	var url_params =
		'?' + 'response_type=token' + '&' + 'redirect_uri=' + prodURL + '&' + 'client_id=advanced-analytics' + '&' + 'scope=' + encodeURIComponent('read write');
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
	document.getElementById('table').classList.remove('hidden');

    for (const article of articles) {
        const sectionId = article.section_id;
        const sectionData = sectionMapping[sectionId];
        const { category, parentSections } = sectionData;

        const tableRow = document.createElement('tr');
		tableRow.setAttribute('data-category-name', category.name);

		// New category position cell "C"
		const categoryPositionCell = document.createElement('td');
		categoryPositionCell.innerText = category.position;
		categoryPositionCell.setAttribute('data-category',category.name);  // Adding data-category attribute for consistency
		categoryPositionCell.setAttribute('data-position',category.position);
		categoryPositionCell.setAttribute('data-showposition',false);
		tableRow.appendChild(categoryPositionCell);

		// New section position cells "S1" to "S6"
		const maxParentSections = 6;
		const reversedParentSections = [...parentSections].reverse();
		for(let i = 0;i < maxParentSections;i++) {
			const sectionPositionCell = document.createElement('td');
			sectionPositionCell.setAttribute('data-showposition',false);
			if(reversedParentSections[i]) {
				sectionPositionCell.innerText = reversedParentSections[i].position;
				sectionPositionCell.setAttribute('data-section',reversedParentSections[i].name);
				sectionPositionCell.setAttribute('data-position',reversedParentSections[i].position);
			} else {
				sectionPositionCell.innerText = ''; // Blank if no section
				sectionPositionCell.setAttribute('data-section','');
			}
			tableRow.appendChild(sectionPositionCell);
		}

		// New article name position cell "A"
		const articleNamePositionCell = document.createElement('td');
		articleNamePositionCell.innerText = article.position;
		articleNamePositionCell.setAttribute('data-position',article.position);
		articleNamePositionCell.setAttribute('data-showposition',false);
		tableRow.appendChild(articleNamePositionCell);

        // Category cell with position and data-category attributes
        const categoryCell = document.createElement('td');
        categoryCell.innerText = `${category.name}`;
        categoryCell.setAttribute('data-position', category.position);
        categoryCell.setAttribute('data-category', category.name);
        tableRow.appendChild(categoryCell);

        // Parent Section cells with position and data-section attributes
        for (let i = 0; i < maxParentSections; i++) {
            const parentSectionCell = document.createElement('td');
            if (reversedParentSections[i]) {
                parentSectionCell.innerText = `${reversedParentSections[i].name}`;
                parentSectionCell.setAttribute('data-position', reversedParentSections[i].position);
                parentSectionCell.setAttribute('data-section', reversedParentSections[i].name);
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

        // Add article ID cell
        const articleIdCell = document.createElement('td');
        articleIdCell.innerText = article.id;
		articleIdCell.setAttribute('data-id', article.id);
        tableRow.appendChild(articleIdCell);

		const userSegmentIdCell = document.createElement('td');
		userSegmentIdCell.innerText = article.user_segment_id;
		userSegmentIdCell.setAttribute('data-user-segment',article.user_segment_id);
		tableRow.appendChild(userSegmentIdCell);

		const userSegmentNameCell = document.createElement('td');
		const userSegment = userSegments.find((segment) => segment.user_segment_id === article.user_segment_id);
		userSegmentNameCell.innerText = userSegment ? userSegment.name : '';
		userSegmentNameCell.setAttribute('data-user-segment-name',userSegment ? userSegment.name : '');
		tableRow.appendChild(userSegmentNameCell);

		// Add edited_at cell
		const editedAtCell = document.createElement('td');
		editedAtCell.innerText = article.edited_at;
		editedAtCell.setAttribute('data-edited-at', article.edited_at);
		tableRow.appendChild(editedAtCell);

		// Add updated_at cell
		const updatedAtCell = document.createElement('td');
		updatedAtCell.innerText = article.updated_at;
		updatedAtCell.setAttribute('data-updated-at', article.updated_at);
		tableRow.appendChild(updatedAtCell);

		// For the plural user_segment_ids field
		const userSegmentIdsCell = document.createElement('td');
		userSegmentIdsCell.innerText = Array.isArray(article.user_segment_ids) ? article.user_segment_ids.join(', ') : article.user_segment_ids || '';
		tableRow.appendChild(userSegmentIdsCell);

		// For the plural user_segment_ids field
		const userSegmentNamesCell = document.createElement('td');
		let segmentNames = '';
		if(Array.isArray(article.user_segment_ids)) {
			segmentNames = article.user_segment_ids.map(id => {
				const segment = userSegments.find(s => s.user_segment_id === id);
				return segment ? segment.name : `Unknown (${id})`;
			}).filter(name => name !== '').join(', ');
		} else if(article.user_segment_ids) {
			const segment = userSegments.find(s => s.user_segment_id === article.user_segment_ids);
			segmentNames = segment ? segment.name : `Unknown (${article.user_segment_ids})`;
		}
		userSegmentNamesCell.innerText = segmentNames;
		tableRow.appendChild(userSegmentNamesCell);

		//User Type for now this is a SEGMENT field
		// const userTypeCell = document.createElement('td');
		// userTypeCell.innerText = userSegment ? userSegment.user_segment_user_type : '';
		// tableRow.appendChild(userTypeCell);

		const userTypeCell = document.createElement('td');
		let userTypes = [];
		if(Array.isArray(article.user_segment_ids) && article.user_segment_ids.length > 0) {
			userTypes = article.user_segment_ids.map(id => {
				const segment = userSegments.find(s => s.user_segment_id === id);
				if(segment && segment.user_segment_user_type) {
					return `${segment.name}: ${segment.user_segment_user_type}`;
				} else {
					return `Unknown (${id}): N/A`;
				}
			});
		} else {
			userTypes.push('No user segments');
		}
		userTypeCell.innerText = userTypes.join(', ');
		tableRow.appendChild(userTypeCell);

		const authorIdCell = document.createElement('td');
		authorIdCell.innerText = article.author_id || '';
		tableRow.appendChild(authorIdCell);

		const createdAtCell = document.createElement('td');
		createdAtCell.innerText = article.created_at || '';
		tableRow.appendChild(createdAtCell);

		const draftCell = document.createElement('td');
		draftCell.innerText = article.draft !== undefined ? article.draft.toString() : '';
		tableRow.appendChild(draftCell);

		const htmlUrlCell = document.createElement('td');
		htmlUrlCell.innerText = article.html_url || '';
		tableRow.appendChild(htmlUrlCell);

		const voteCountCell = document.createElement('td');
		voteCountCell.innerText = article.vote_count !== undefined ? article.vote_count.toString() : '';
		tableRow.appendChild(voteCountCell);

		const voteSumCell = document.createElement('td');
		voteSumCell.innerText = article.vote_sum !== undefined ? article.vote_sum.toString() : '';
		tableRow.appendChild(voteSumCell);

		tableBody.appendChild(tableRow);
    }

	// Now grab the table data, convert to json, and save to table1APIdata variable
	table1APIdata = convertTableToJson('table');
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

		const allData = {articles, sections, categories};
		combinedData = allData;
		console.log('All data fetched:', allData);

		// Step 2: Create the section mapping
		const sectionMapping = createSectionMapping(sections, categories);

		// Sort articles based on the position of their categories
		articles.sort((a, b) => {
			const categoryA = sectionMapping[a.section_id].category;
			const categoryB = sectionMapping[b.section_id].category;
			return categoryA.position - categoryB.position;
		});

		// Function to extract unique user segment ids
		function getUniqueUserSegmentIds(articles) {
			const uniqueIds = new Set(); // Using a set to store unique ids
			articles.forEach(article => {
				if(Array.isArray(article.user_segment_ids) && article.user_segment_ids.length > 0) {
					article.user_segment_ids.forEach(id => {
						if(id != null) {
							uniqueIds.add(id);
						}
					});
				} else {
					console.log('No user segment IDs found for article ID:',article.id,article);
				}
			});
			return Array.from(uniqueIds); // Convert set back to array
		}

		const userSegmentIDs = getUniqueUserSegmentIds(articles);
		// loop over the userSegmentIDs, find unique ones and make a request for each one to fetch the name
		const userSegments = await getSegmentNames(userSegmentIDs);

		// Log no of API calls
		document.getElementById('apiCount').innerText = noApiCalls;

		return { articles, sectionMapping, userSegments };
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
	document.getElementById('table').style.display = 'block';
}

function downloadXLSX() {
	const table = document.getElementById('table');
	const workbook = XLSX.utils.table_to_book(table);
	const xlsxBlob = XLSX.write(workbook,{bookType: 'xlsx',type: 'binary'});

	function s2ab(s) {
		const buf = new ArrayBuffer(s.length);
		const view = new Uint8Array(buf);
		for(let i = 0;i < s.length;i++) view[i] = s.charCodeAt(i) & 0xFF;
		return buf;
	}

	const blob = new Blob([s2ab(xlsxBlob)],{type: 'application/octet-stream'});
	const link = document.createElement('a');
	const url = URL.createObjectURL(blob);
	link.setAttribute('href',url);
	link.setAttribute('download','table_data.xlsx');
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

//Stopgap function for sorting
function reorganizeTable() {
    const table = document.querySelector('table');
    if (!table) {
        console.error('Table not found');
        return;
    }

    const rows = Array.from(table.querySelectorAll('tbody tr'));

    const sortedRows = rows.sort((a, b) => {
        const aCells = a.querySelectorAll('td');
        const bCells = b.querySelectorAll('td');

        // Compare first column (C for category)
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

    // Append the sorted rows back to the tbody
    const tableBody = table.querySelector('tbody');
    sortedRows.forEach(row => tableBody.appendChild(row));

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

// Event Listeners
document
	.getElementById('fetch-all-data')
	.addEventListener('click', async () => {
		showSpinner();

		try {
			const { articles, sectionMapping, userSegments } =
				await fetchAllDataAndCreateMapping();
			buildTable(articles, sectionMapping);
			shiftSectionCells();
			addBorder();
			reorganizeTable();
		} catch (error) {
			console.log('Error fetching data and building table:', error);
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

function showPositionNumbers() {
	const cells = document.querySelectorAll('[data-position]:not([data-showPosition="false"])');
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

//// ----------------- Upload Excel File ----------------- ////

// Upload data from other sources
document.getElementById('upload-sheet').addEventListener('change',function(event) {
	const file = event.target.files[0];
	if(!file) {
		return;
	}

	const reader = new FileReader();
	reader.onload = function(event) {
		const data = new Uint8Array(event.target.result);
		const workbook = XLSX.read(data,{type: 'array'});

		// Assuming the first sheet
		const firstSheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[firstSheetName];

		// Convert sheet to JSON
		const json = XLSX.utils.sheet_to_json(worksheet);
		renderTable(json);
		// Save the data to a variable
		table2csvData = json;
	};
	reader.readAsArrayBuffer(file);
});

// Function to extract data from the table and convert it to JSON
function convertTableToJson(tableElement) {
	const table = document.getElementById(tableElement); // Get the table by ID
	const theadRow = table.querySelectorAll('thead tr th'); // Get header row to use as keys
	const tbody = table.querySelector('tbody'); // Get the tbody element where data rows are
	const rows = tbody.querySelectorAll('tr'); // Get all data rows

	const headers = Array.from(theadRow).map(header => header.textContent); // Map headers to text
	const data = []; // Array to store each row's data as an object

	rows.forEach(row => {
		const cells = row.querySelectorAll('td'); // Get all cells in the row
		const rowData = {}; // Object to store row data keyed by header names

		cells.forEach((cell,index) => {
			// Using header names as keys, cell text as value
			rowData[headers[index]] = cell.textContent;
			// For capturing data attributes you can expand this logic
			// Example: rowData[headers[index] + '_id'] = cell.getAttribute('data-id');
		});

		data.push(rowData); // Add the constructed row object to the data array
	});

	return data; // Return the array of row objects
}

function renderTable(data) { // TODO: Combine with/replace buildTable function
	const container = document.getElementById('tableContainer');
	const table = document.createElement('table');
	table.id = 'table2';
	table.style.width = '100%';
	table.setAttribute('border','1');

	const thead = document.createElement('thead');
	const tbody = document.createElement('tbody');

	// Adding header row
	const headerRow = document.createElement('tr');
	Object.keys(data[0]).forEach(key => {
		const th = document.createElement('th');
		th.textContent = key;
		headerRow.appendChild(th);
	});
	thead.appendChild(headerRow);

	// Adding data rows
	data.forEach(row => {
		const tr = document.createElement('tr');
		Object.values(row).forEach(val => {
			const td = document.createElement('td');
			td.textContent = val || ""; // Handling undefined or null values
			tr.appendChild(td);
		});
		tbody.appendChild(tr);
	});

	table.appendChild(thead);
	table.appendChild(tbody);
	container.innerHTML = '';
	container.appendChild(table);
}

function mergeData(apiData,xlsData) {
	const mergedData = []; // This will store the combined data

	const articleIdKey = xlsData[0] && ('Article ID' in xlsData[0]) ? 'Article ID' : 'Event article ID';

	// Iterate over each entry in xlsData
	xlsData.forEach(xlsEntry => {
		// Find the corresponding entry in apiData based on 'Article ID'

		const apiEntry = apiData.find(api => api['Article ID'] === xlsEntry[articleIdKey]);

		// Use a placeholder if no apiData is found
		const combinedEntry = {
			...apiEntry, // Spread all properties from apiData entry if found
			...xlsEntry // Spread all properties from xlsData entry
		};

		// Add the combined or standalone object to the result array
		mergedData.push(combinedEntry);
	});

	return mergedData;
}


document.getElementById('combine').addEventListener('click',function() {
	combinedTableData = mergeData(table1APIdata,table2csvData);
	const tableContainer = document.getElementById('tableContainer');

	// Remove previous tables if they exist
	if(document.getElementById('table')) {
		document.getElementById('table').remove();
	}
	if(document.getElementById('table2')) {
		document.getElementById('table2').remove();
	}

	// Create a new table element to display the combined data
	const table = document.createElement('table');
	table.id = 'table3';
	table.className = 'table'; // Add a class if you have specific styles for tables

	// Use SheetJS to convert JSON data to an HTML table
	const worksheet = XLSX.utils.json_to_sheet(combinedTableData);
	const htmlString = XLSX.utils.sheet_to_html(worksheet,{id: 'table3',editable: false});

	// Temporarily create an element to hold the HTML content
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = htmlString;

	// Extract the table from tempDiv and append it to the tableContainer
	const newTable = tempDiv.querySelector('table');
	tableContainer.appendChild(newTable);
});

document.getElementById('download-combined').addEventListener('click',function() {
	// Assume combinedTableData is a global variable containing your combined data
	if(!combinedTableData || combinedTableData.length === 0) {
		alert('No data available to download.');
		return;
	}

	// Create a new workbook and worksheet with SheetJS
	const workbook = XLSX.utils.book_new();
	const worksheet = XLSX.utils.json_to_sheet(combinedTableData);

	// Append the worksheet to the workbook
	XLSX.utils.book_append_sheet(workbook,worksheet,'Combined Data');

	// Define the file name
	const fileName = 'CombinedDataNew.xlsx';

	// Trigger the download using SheetJS
	XLSX.writeFile(workbook,fileName);
});


