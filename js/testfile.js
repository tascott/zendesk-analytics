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
		parentSections.unshift(section);

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
		const categoryCell = document.createElement('td');
		// categoryCell.innerText = category.name;
		categoryCell.innerText = `${category.name} (Position: ${category.position})`; // add category position
		tableRow.appendChild(categoryCell);

		// Add parent section cells
		const maxParentSections = 6;
		const reversedParentSections = [...parentSections].reverse();
		for (let i = 0; i < maxParentSections; i++) {
			const parentSectionCell = document.createElement('td');
			if (reversedParentSections[i]) {
				// parentSectionCell.innerText = reversedParentSections[i].name;
				parentSectionCell.innerText = `${reversedParentSections[i].name} (Position: ${reversedParentSections[i].position})`; // add section position
			} else {
				parentSectionCell.innerText = '';
			}
			tableRow.appendChild(parentSectionCell);
		}

		// Add article name cell
		const articleCell = document.createElement('td');
		// articleCell.innerText = article.title;
		articleCell.innerText = `${article.title} (Position: ${article.position})`; // add article position
		tableRow.appendChild(articleCell);

		// Add article ID cell
		const articleIdCell = document.createElement('td');
		articleIdCell.innerText = article.id;
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
					sectionCells[j].innerText = sectionCells[j + 1].innerText;
					sectionCells[j + 1].innerText = '';
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

		// Sort articles (rows) based on the position of their categories
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