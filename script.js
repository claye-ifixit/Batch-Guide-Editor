// JavaScript Document
// Controls page behavior, guide searching, and guide loading

const
apiUrl		= 'https://www.ifixit.com/api/2.0/';

var
logs		= document.getElementById('console'),		// log console div up top. referenced only for debugging
authInput	= document.getElementById('authToken'),		// input for auth token to be used for api calls
authorsEl	= document.getElementById('authors'),		// textarea to enter author filtering
urlsEl		= document.getElementById('urls'),			// textarea to enter guideids or device urls
hasLogged	= false,									// used for the startup text
hasSearched = false,									// used for startup text
qtySearched = document.getElementById('qtyS'),
qtyLoaded	= document.getElementById('qtyL'),
findList	= {},										// meaty. {#id: ""title} of every searched guide on searchBtn click
findListUl	= document.getElementById('guides_list'),	// ul containing search results
toggleBtn	= document.getElementById('toggleAll'),		// just the select/deselect all button. dynamically changes textcontent
allChecked	= false,									// true only if all checkboxes are .checked
loadList	= [],										// meaty. [#id, #id, ...] of all guides to edit
loadListUl	= document.getElementById('loaded_list'),	// ul containing loaded guides
exportBtn	= document.getElementById('export'),		// just the button that copies the loaded list to your clipboard
canSuggest	= true,
suggQueue	= false,
popup		= document.getElementById('edited_guides_container'),
popupTxt	= document.getElementById('edited_guides');


// SEARCH GUIDES - STORE SEARCHES TO findList{} and CALL FOR SELECT (FIND) LIST DOM MODIFICATIONS
async function searchGuides()
{
	let authentication;
	try
	{
		authentication = await xhr_get('user', null);
	}
	catch (e)
	{
		authentication = false;
	}

	if (!authentication)
	{
		log(`User authentication failed.`);

		markCompletion(authInput, false);
		
		return;
	}

	// clear list items that were errors
	while (findListUl.getElementsByClassName('invalid')[0])
	{
		findListUl.getElementsByClassName('invalid')[0].remove();
	}

	// store search textarea value and author value
	let
	validLines	= 0,			// # valid lines of input
	validAuths	= -1,			// # valid authors entered... -1: info entered but none valid, 0: no info entered, 1+: some info entered and all valid
	searchValue	= urlsEl.value,				// raw string of urls textarea
	authorValue = authorsEl.value,			// raw string of authors textarea
	publicity	= parseInt(document.getElementById('publicity').value);			// int of publicity... -1: no preference, 0: private, 1: public

	// convert search and authors textareas values to arrays
	const
	searchArray			= searchValue.split('\n'),
	authorsUnfiltered	= authorValue.split('\n');
	

	// AUTHORS FILTERING

	const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

	// return array of author ids from textarea
	var createAuthorArray = async function(authorStr, unfilteredArray)
	{
		// skip if no input, but record that there is no input
		if (authorStr === '')
		{
			validAuths = 0;
			return undefined;
		}

		// create array of author emails
		var idsArray = [],		// used below
		authorsArray = unfilteredArray.map(function(author)
		{
			// if this line contains valid author email
			// (1st line) count 1 valid author or (subsequent) just add one to existing count
			// else record the invalid authors
			if (author.match(regex))
			{
				validAuths = (validAuths === -1 ? 1 : validAuths + 1);
				return author;
			}
			else
			{
				// Currently not used. Can do something here if desired
				invalidAuthors.push(author);
			}
			
			return undefined;
		})
		.filter(a => a !== undefined);

		if (validAuths === -1)
		{
			return undefined;
		}

		// create array of author ids, using the array of strings authorsArray
		for (let authorEmail of authorsArray)
		{
			let authorResponse
			try
			{
				authorResponse = await xhr_get('users/email', authorEmail);

				idsArray.push(authorResponse['userid']);

				log(`Author "${authorEmail}" resolved successfully.`);
			}
			catch (error)
			{
				log(`Author "${authorEmail}" not resolved (${error})`);

				return new Error(error);
			}
		}

		return idsArray;
	};

	let
	invalidAuthors	= [],		// Currently not used, but could present these somehow
	authorIdsArray	= [];

	try
	{
		authorIdsArray = await createAuthorArray(authorValue, authorsUnfiltered);
	}
	catch(e)
	{
		console.log(e);
	}

	if (validAuths === -1)
	{
		markCompletion(authorsEl, false);
		return;
	}

	let searchAttempts = 0;

	// loop through search textarea value {int:id or str:url} array
	for (let line of searchArray)
	{
		searchAttempts++;

		const
		regex_ids		= /^\d+$/,
		regex_urls		= /^(https:\/\/www.){0,1}ifixit.com\/Device\/.+$/,
		regex_urlFilter	= /^(https:\/\/www.){0,1}ifixit.com\/Device\//;
		
		// IF THIS LINE ITERATION IS A int:GUIDEID
		if (line.match(regex_ids))
		{
			validLines++;

			let id = line;		// easy peasy just the integer guide id
			
			// request the detailed guide object of this id
			xhr_get('guides', id, true)
			.then(function(guide) {				
				const
				title		= guide['title'],
				authorId	= guide['author']['userid'],
				public		= guide['public'];
				
				// filter authors
				if (authorValue !== '' && authorIdsArray !== undefined && !authorIdsArray.includes(authorId))
				{
					log(`Guide ${id} author mismatch. Actual author: ${guide['author']['unique_username']}`);
					return;
				}
				
				// filter publicity
				if (publicity !== -1)
				{
					if (public != publicity)
					{
						log(`Guide ${id} publicity mismatch. Actual publicity: ${public}`);
						return;
					}
				}
				
				// no duplicates
				if (findList[id])
				{
					log(`${id} is already in list`);
					return;
				}
				
				let
				displayInfo = {
					'guideid': id,
					'author': guide['author']['username'],
					'publicity': public ? 'Public' : 'Private'
				}
				
				log(`Added ${id} to list`);
				
				// add this id:title pair to the search list json
				findList[id] = title;
				
				// create list item to findListUl
				addToFindList(id, true, displayInfo);
				
				return;
			})
			.catch(function(error)
			{
				log(`Failed to retrieve guide ${id} (${error})`);

				let
				displayInfo = {
					'error': error
				}

				addToFindList(id, false, displayInfo);

				return;
			})
			.finally(function()
			{
				if (searchAttempts === searchArray.length && Object.keys(findList).length === 0)
				{
					findListUl.innerHTML = 'No Results';
				}
			});
		}
		
		// IF THIS LINE ITERATION IS A str:URL
		if (line.match(regex_urls))
		{
			validLines++

			const line_subUrl = line.replace(regex_urlFilter, '');		// the end of the url, containing only the device name
			
			let
			searchAttempts = 0;

			// request every guide belonging to this device
			xhr_get('categories', line_subUrl)
			.then(function(device)
			{
				const guides = device['guides'];	// all guides (non- prereq-only)
				
				// iterate over each simple-guide-object of this device
				for (let guide in guides)
				{
					searchAttempts++;

					const
					id			= guides[guide]['guideid'],
					title		= guides[guide]['title'],
					authorId	= guides[guide]['userid'],
					public		= guides[guide]['public'],
					guideCat	= guides[guide]['category'];

					// ADD THIS GUIDE'S PREREQS, TOO
					// request this detailed-guide-object in the current iteration
					xhr_get('guides', id)
					.then(function(g)
					{
						// within this guide-object, iterate over its prereqs (simple-objects)
						for (let p of g['prerequisites'])
						{
							if (p['flags'].includes('GUIDE_PREREQ_ONLY'))
							{
								const
								id			= p['guideid'],
								title		= p['title'],
								author		= p['userid'],
								public		= p['public'],
								prereqcat	= p['category'];

								// author filtering of the prereq
								if (authorIdsArray !== undefined && !authorIdsArray.includes(author))
								{
									log(`Guide ${id} author mismatch. Actual author: ${p['username']}`);
									continue;
								}

								// filter publicity of the prereq
								if (publicity !== -1)
								{
									if (public != publicity)
									{
										log(`Guide ${id} publicity mismatch. Actual publicity: ${public}`);
										continue;
									}
								}

								// skip prereqs that originate from a different device
								if (prereqcat !== guideCat) continue;

								// skip duplicates according to the findlist{} (DOM is ignored here, but they coincide later)
								if (findList.hasOwnProperty(id)) continue;

								let
								displayInfo = {
									'guideid': id,
									'author': p['username'],
									'publicity': public ? 'Public' : 'Private'
								}

								// add this prereq to the list
								log(`Added ${id} to list`);
								findList[id] = title;
								addToFindList(id, true, displayInfo);
							}
						}
						return;
					})
					.catch(function(error)
					{
						log(`Failed to retrieve guide ${id} (${error})`);
						
						let displayInfo = {
							'error': error
						}

						addToFindList(id, false, displayInfo);

						return;
					});


					// NOW ADD THIS GUIDE
					// filter author
					if (authorIdsArray !== undefined && !authorIdsArray.includes(authorId))
					{
						log(`Guide ${id} author mismatch. Actual author: ${guides[guide]['username']}`);
						continue;
					}

					// filter publicity
					if (publicity !== -1)
					{
						if (public != publicity)
						{
							log(`Guide ${id} publicity mismatch. Actual publicity: ${public}`);
							continue;
						}
					}

					// no duplicates
					if (findList[id])
					{
						log(`${id} is already in list`);
						continue;
					}

					let
					displayInfo = {
						'guideid': id,
						'author': guides[guide]['username'],
						'publicity': public ? 'Public' : 'Private'
					}

					// add it, babyyyy
					log(`Added ${id} to list`);

					findList[id] = title;

					addToFindList(id, true, displayInfo);
				}

				return;
			})
			.catch(function(error)
			{
				log(`Error (${error})`);
				return;
			})
			.finally(function()
			{
				if (Object.keys(findList).length === 0)
				{
					findListUl.innerHTML = 'No Results';
				}
			});
		}
	}

	if (validLines < 1)
	{
		markCompletion(urlsEl, false);
	}

	allChecked = false;		// because each time user searches, list will populate. newly found guides are not yet checked.
	toggleBtn.innerHTML = 'Select All';		// reset this, for the same reason 

	return;
}

// APPEND DOM ELEMENTS FOR SELECT GUIDES
function addToFindList(id, valid, displayInfo)
{

	if (!hasSearched || findListUl.innerHTML === 'No Results')
	{
		findListUl.innerHTML = '';
		hasSearched = true;
	}


	// don't draw duplicates
	if (document.getElementById(id)) {
		return;
	}

	// okay lets do it

	qtySearched.innerHTML = parseInt(qtySearched.innerHTML) + 1;

	let
	liFragment	= new DocumentFragment(),
	listEl		= document.createElement('li');

	listEl.classList.add('semantic');

	if (!valid)
	{
		let
		invalidText = document.createTextNode(`Guide ${id} Not Found`);

		listEl.classList.add('invalid');
		listEl.id = id;
		listEl.setAttribute('title', displayInfo['error']);

		listEl.appendChild(invalidText);
	}
	else
	{
		let
		checkEl		= document.createElement('input'),
		labelEl		= document.createElement('label'),
		labelText	= document.createTextNode(findList[id]);
	
	
		checkEl.setAttribute('type', 'checkbox');
		checkEl.classList.add('check');
		checkEl.id = id;
		checkEl.addEventListener('click', checkClick);
	
		labelEl.setAttribute('for', id);
		labelEl.appendChild(labelText);
	
		listEl.setAttribute('Title', `Guide ID: ${displayInfo['guideid']}. Author: ${displayInfo['author']}. Publicity: ${displayInfo['publicity']}.`);
		listEl.appendChild(checkEl);
		listEl.appendChild(labelEl);
	}

	liFragment.appendChild(listEl);

	findListUl.appendChild(liFragment);

	return;
}

// LOAD GUIDES INTO LIST
function loadGuides()
{
	let
	selectItems	= findListUl.querySelectorAll('input');

	for (let input of selectItems)
	{
		const
		id = input.id,
		title = input.parentElement.querySelector(`label[for="${id}"]`).innerHTML;
		
		if (!input.checked || loadList.includes(id))
		{
			continue;
		}

		loadList.push(id);
		
		addToLoadedList(id, title);
	}
	return;
}

// APPEND DOM ELEMENTS TO LOADED LIST
function addToLoadedList(id, title)
{
	qtyLoaded.innerHTML = parseInt(qtyLoaded.innerHTML) + 1;

	let
	liFragment	= new DocumentFragment(),
	listEl		= document.createElement('li'),
	listText	= document.createTextNode(title),
	listRemove	= document.createElement('span'),
	removeTxt	= document.createTextNode('— Remove');

	listRemove.appendChild(removeTxt);
	listRemove.classList.add('loadedBtn-remove');
	listRemove.setAttribute('data-id', id);
	listRemove.addEventListener('click', removeLoaded);

	listEl.setAttribute('data-id', id);
	listEl.setAttribute('title', id);
	listEl.appendChild(listText);
	listEl.appendChild(listRemove);

	liFragment.appendChild(listEl);

	loadListUl.appendChild(liFragment);

	markCompletion(listEl, true);

	log(`Loaded ${id} into list`);

	return;
}

// CALLED WHENEVER A CHECK IS CLICKED, EITHER BY USER OR BY TOGGLEBTN
function checkClick()
{
	let checks = findListUl.getElementsByClassName('check');

	allChecked = true;

	for (let check of checks)
	{
		if (!check.checked) allChecked = false;
	}

	if (allChecked)	toggleBtn.innerHTML = 'Deselect All';
	else			toggleBtn.innerHTML = 'Select All';

	return;
}

// SELECT/DESELECT ALL
function toggleAll()
{
	let
	checks = findListUl.getElementsByClassName('check');
	
	if (allChecked)
	{
		for (let check of checks)
		{
			check.click();
		}
	}
	else
	{
		for (let check of checks)
		{
			if (!check.checked)
			{
				check.click();
			}
		}
	}
}

// EMPTY THE FIND LIST
function deleteFindList()
{
	// loop through the first list item of the ul, deleting it as it goes
	while (findListUl.firstChild)
	{
		let
		li		= findListUl.firstChild,
		check	= (li instanceof HTMLLIElement ? li.getElementsByClassName('check')[0] : undefined);

		// remove the click event listener from li>input[checkbox].check before removing li
		if (check && check.classList.contains('check'))
		{
			check.removeEventListener('click', checkClick);
		}

		findListUl.removeChild(li);
	}

	// prep for the next search
	qtySearched.innerHTML = 0;
	findListUl.innerHTML = 'Searched guides will appear here...';
	findList = {};
	hasSearched = false;
	allChecked = false;
	toggleBtn.innerHTML = 'Select All';
}

// DELETE BUTTON TO REMOVE GUIDES FROM THE LOADED LIST
function removeLoaded(clickEvent)
{
	const
	button	= clickEvent.target,
	id		= button.getAttribute('data-id'),
	index	= loadList.indexOf(id);
	
	if (index === -1)
	{
		log('Index of desired id not found');
		return;
	}

	qtyLoaded.innerHTML = parseInt(qtyLoaded.innerHTML) - 1;
	
	loadList.splice(index, 1);
	
	button.removeEventListener('click', removeLoaded);
	loadListUl.removeChild(button.parentNode);

	log(`Removed ${button.id} from list at index ${index}`);

	return;
}

// EXPORT THE LOADED LIST
var exportList = async() =>
{
	let
	array		= [],
	list	= loadListUl.querySelectorAll('li'),
	text = '';

	if (list.length === 0)
	{
		return;
	}

	for (let li of list)
	{
		array.push(`https://www.ifixit.com/Guide/g/${li.getAttribute('data-id')}`);
	}

	text = array.join('\n');

	try
	{
		await navigator.clipboard.writeText(text);

		exportBtn.classList.add('successful');
		exportBtn.innerHTML = 'Copied!';

		setTimeout(function()
		{
			exportBtn.classList.remove('successful');
			exportBtn.innerHTML = 'Export List';
		},
		2000);
	}
	catch (e)
	{
		exportBtn.classList.add('failed');
		exportBtn.innerHTML = 'Failed';
		
		setTimeout(function()
		{
			exportBtn.classList.remove('failed');
			exportBtn.innerHTML = 'Export List';
		},
		2000);
	}
	
	return;
};

// INSERT THE SUGGESTED FLAG INTO THE TEXT FIELD
function flagSuggestion(e)
{
	const
	flagsInput	= document.getElementById('flags'),
	flagsValue	= flagsInput.value,
	// if the li is clicked, get its data-flagid. if the span inside the li is clicked, get its parent li's data-flagid
	flagid		= e.target instanceof HTMLSpanElement ? e.target.parentElement.getAttribute('data-flagid') : e.target.getAttribute('data-flagid');

	let newValue = '';

	// if there are multiple flags typed in, just replace the last comma and trailing text with the clicked flag
	if (flagsValue.match(/^.+\s*,\s*/))
	{
		newValue = flagsValue.replace(/\s*,[^,]*$/, `, ${flagid}, `);
	}
	// otherwise replace the entire field with the clicked flag
	else
	{
		newValue = `${flagid}, `;
	}

	flagsInput.value = newValue;

	return;
}

// UPDATE THE DOM WITH FLAGS THAT YOU SEARCHED
function drawFlags(k)
{
	// throttling control
	if (!canSuggest)
	{
		// but queue up this function to still run once after delay is over
		if (!suggQueue)
		{
			suggQueue = true;
		}
		return;
	}

	// mark the throttle
	canSuggest = false;


	const
	flagsSugg	= document.getElementById('flagsSugg'),	// this is the ul parent container
	fieldInput	= document.getElementById('flags'),		// input field
	fieldValue	= fieldInput.value;						// raw input string


	// if allowed to run, then throttle for 700ms. When delay is over, check if this func is queued to run, and run it
	setTimeout(function()
	{
		canSuggest = true;

		if (suggQueue)
		{
			// calling this function from a non-keydown is blasphemous, so pass an explcit undef arg
			drawFlags(undefined);
			suggQueue = false;
		}
		// double-check that the element is unfocused and ensure that the list is hidden, since sometimes the browser misses the focusout event
		else if (document.activeElement !== fieldInput)
		{
			flagsSugg.classList.remove('visible');
		}
	},
	700);

	// if this func was indeed called from a keydown, make sure its only a printable character or a backspace
	if (k && k.key && k.key.length !== 1 && k.key !== 'Backspace')
	{
		return;
	}

	// if there is only one flag being typed, search for everything up to the first comma or end of string
	// if there are one or more flags typed in, search for whats typed after the last comma
	let
	toSearch	= fieldValue.match(/^[^,]*,*\s*$/) ? fieldValue.match(/^([^,]*)(,*\s*)$/)[1] : fieldValue.match(/^(.*,\s*)*(.*)$/)[2];

	// since this event is keydown, and not keypress, the to-be-key isn't alive yet. thus, add it manually to the end of the search
	if (k && k.key && k.key.length === 1)
	{
		toSearch = toSearch+k.key;
	}

	// call all available flags
	xhr_get('user', 'flags')
	.then(function(flagsObj)
	{
		// empty the ul for preparation of the new search results
		while (flagsSugg.firstChild)
		{
			flagsSugg.firstChild.removeEventListener('mousedown', flagSuggestion);
			flagsSugg.removeChild(flagsSugg.firstChild);
		}
	
		let
		regex		= new RegExp(toSearch, 'i'),	// case-insensitive regex of just the search string

		// turn the object of objects into an array of objects, those of which contain the search string
		flags 		= Object.values(flagsObj['guide']).filter(f => f['flagid'].match(regex) || f['title'].match(regex)),
		liFragment	= new DocumentFragment();

		// iterate over array of search-matched flag objects
		for (const flag of flags)
		{
			let
			flagid		= flag['flagid'],
			li			= document.createElement('li'),				// child el with class
			liTitle		= document.createElement('span'),			// child of li with title
			idText		= document.createTextNode(flagid),			// text to go in li
			titleText	= document.createTextNode(flag['title']);	// text to go in span

			liTitle.appendChild(titleText);
			liTitle.classList.add('flagSugg-title');

			li.appendChild(idText);
			li.setAttribute('data-flagid', flagid);
			li.classList.add('flagSuggli');
			li.addEventListener('mousedown', flagSuggestion);

			li.appendChild(liTitle);

			liFragment.appendChild(li);
		}

		flagsSugg.appendChild(liFragment);

		flagsSugg.classList.add('visible');

		return;
	})
	.catch(function(error)
	{
		log(`Couldn't load preset flags (${error})`);

		return;
	});

	return;
}

// MAKE AJAX GET REQUESTS
function xhr_get(type, data)
{
	if (data !== null)	log(`Sending API call ${type}/${data}...`);
	else				log(`Sending API call ${type}...`);

	return new Promise(function(resolve, reject) {
		
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function()
		{
			if (xhr.readyState === 4)
			{
				if (xhr.status === 200)
				{
					const response = JSON.parse(xhr.responseText);
					resolve(response);
				}
				else
				{
					reject(new Error(xhr.status));
				}
			}
		}
		xhr.onerror = function() {
			reject(new Error('Unknown network error'));
		};
		if (data !== null)	xhr.open('GET', apiUrl+type+'/'+data, true);
		else				xhr.open('GET', apiUrl+type, true);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.setRequestHeader('X-App-Id', 'be0ef8241c0be993ae73c407e6c536b9');
		xhr.setRequestHeader('Authorization', `api ${authInput.value}`);
		xhr.send();
	});
}

// RECORD STATUS LOGS IN DIV
function log(message)
{
	if (!hasLogged)
	{
		logs.innerHTML = '';
		hasLogged = true;
	}
	logs.innerHTML += message + '<br>';
	logs.scrollTop = logs.scrollHeight;
	return;
}

/**	Mark the input field as successful (greenish) or failed (reddish) on submit
 * @param {Node} inputEl
 * @param {Bool} success 
 * @returns undefined
 */
function markCompletion(inputEl, success)
{
	inputEl.classList.add((success ? 'completed' : 'failed'));

	setTimeout(() =>
	{
		inputEl.classList.remove((success ? 'completed' : 'failed'));
	},
	2000);

	return;
}

// DISPLAY OR HIDE LOADING ELEMENTS
function styleLoading(el, toggle)
{
	if (toggle)	el.classList.add('visible');
	else		el.classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', function() {
	const
	searchBtn	= this.getElementById('search'),
	checkAllBtn = this.getElementById('toggleAll'),
	clearBtn	= this.getElementById('clearAll'),
	loadBtn		= this.getElementById('load'),
	flagsInput	= this.getElementById('flags');

	searchBtn.addEventListener('click', searchGuides);

	checkAllBtn.addEventListener('click', toggleAll);
	
	clearBtn.addEventListener('click', deleteFindList);

	loadBtn.addEventListener('click', loadGuides);

	exportBtn.addEventListener('click', exportList);


	flagsInput.addEventListener('focusin', drawFlags);

	flagsInput.addEventListener('focusout', e =>
	{
		document.getElementById('flagsSugg').classList.remove('visible');
	});

	flagsInput.addEventListener('keydown', drawFlags);
});