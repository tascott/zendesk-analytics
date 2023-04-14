/*

Init function

*/

function init() {
    var url = window.location.href;
    if (url.indexOf('http://localhost:5501/advanced-analytics.html') !== -1) {
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

  /*

  Get all the data possible

  */

  async function makeRequestForAll(token, endpoint) {
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
      '?' +
      'response_type=token' +
      '&' +
      'redirect_uri=http://localhost:5501/advanced-analytics.html' +
      '&' +
      'client_id=advanced-analytics' +
      '&' +
      'scope=' +
      encodeURIComponent('read write');
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
      return [section, ...getSectionAncestors(sections, section.parent_section_id, level + 1)];
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

      sectionMapping[section.id] = {
        category: category,
        parentSections: getSectionAncestors(sections, section.parent_section_id),
      };
    });

    return sectionMapping;
  }

  // Modified buildTable function
  function buildTable(articles, sectionMapping) {
    const tableBody = document.getElementById('table-body');

    for (const article of articles) {
      const sectionId = article.section_id;
      const sectionData = sectionMapping[sectionId];
      const { category, parentSections } = sectionData;

      const tableRow = document.createElement('tr');

      // Add category cell
      const categoryCell = document.createElement('td');
      categoryCell.innerText = category.name;
      tableRow.appendChild(categoryCell);

      // Add parent section cells
      const maxParentSections = 6;
      const reversedParentSections = [...parentSections].reverse();
      for (let i = 0; i < maxParentSections; i++) {
        const parentSectionCell = document.createElement('td');
        if (reversedParentSections[i]) {
          parentSectionCell.innerText = reversedParentSections[i].name;
        } else {
          parentSectionCell.innerText = '';
        }
        tableRow.appendChild(parentSectionCell);
      }

      // Add article name cell
      const articleCell = document.createElement('td');
      articleCell.innerText = article.title;
      tableRow.appendChild(articleCell);

      // Add article ID cell
      const articleIdCell = document.createElement('td');
      articleIdCell.innerText = article.id;
      tableRow.appendChild(articleIdCell);

      tableBody.appendChild(tableRow);
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

      const [articles, sections, categories] = await Promise.all([
        articlesPromise,
        sectionsPromise,
        categoriesPromise,
      ]);

      const allData = {
        articles,
        sections,
        categories,
      };

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
    const headerRows = Array.from(table.getElementsByTagName('thead')[0].getElementsByTagName('tr'));
    const bodyRows = Array.from(table.getElementsByTagName('tbody')[0].getElementsByTagName('tr'));
    const allRows = headerRows.concat(bodyRows);

    const csvContent = allRows
      .map((row) => {
        const headerCells = Array.from(row.getElementsByTagName('th'));
        const bodyCells = Array.from(row.getElementsByTagName('td'));
        const allCells = headerCells.concat(bodyCells);
        return allCells.map((cell) => `"${cell.innerText.replace(/"/g, '""')}"`).join(',');
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

    const range = document.createRange();
    const selection = window.getSelection();
    selection.removeAllRanges();

    try {
      range.selectNode(table);
      selection.addRange(range);
      document.execCommand('copy');
      selection.removeAllRanges();

      console.log('Table data copied to clipboard');
    } catch (err) {
      console.error('Failed to copy table data:', err);
    }
  }






  // Event Listeners
  document.getElementById('fetch-all-data').addEventListener('click', async () => {
    showSpinner();

    try {
      const { articles, sectionMapping } = await fetchAllDataAndCreateMapping();
      buildTable(articles, sectionMapping);
    } catch (error) {
      displayError("Error fetching data and building table:", error);
    } finally {
      hideSpinner();
    }
  });


  document.getElementById('copy-table').addEventListener('click', copyTableToClipboard);



  window.addEventListener('load', init, false);