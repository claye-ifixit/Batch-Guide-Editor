// JavaScript Document
// Controls editing guides. This script piggybacks off script.js

/**	ADD FLAGS TO GUIDES
 * 
 */
function addFlags()
{
	let
	flagsInput		= document.getElementById('flags'),
	flagsValue		= flagsInput.value;
	
	if (flagsValue === '')
	{
		markCompletion(flagsInput, false);
		return;
	}

	// trim leading/trailing commas and whitespaces
	flagsValue.replace(/\s*,\s*$/, '');
	flagsValue.replace(/^\s*,\s*/, '');

	let flagsInputArray = flagsValue.split(/\s*,\s*/);

	// Get all available flags
	xhr_get('user', 'flags')
	.then(async function(flagsObj)
	{
		// the flagsObj looks like guide:{"a": {}, "b": {},...} now becomes an array of objects
		const flags = Object.values(flagsObj['guide']);
	
		// filters out the flags that aren't real flags
		flagsInputArray = flags.map(f =>
		{
			if (flagsInputArray.includes(f['flagid']))
			{
				return f['flagid'];
			}
			return undefined;
	
		})
		.filter(f => f !== undefined);

		if (flagsInputArray.length === 0)
		{
			log(`No flags found from the provided input.`);

			markCompletion(flagsInput, false);
			return;
		}
	
		let
		guideCount	= 0,
		attempted	= 0;

		for (const guideid of loadList)
		{
			attempted++;

			try
			{
				let guideObj = await xhr_get('guides', guideid);

				const
				guideFlags		= guideObj['flags'].map(f => f['flagid']),
				revisionId		= guideObj['revisionid'],
				newGuideFlags	= guideFlags.concat(flagsInputArray),
				params			= {'revisionid': revisionId},
				data			= {'flags': newGuideFlags};
	
				xhr_edit('PATCH', guideid, null, params, data)
				.then(function(g)
				{
					guideCount++;

					log(`Flag(s) ${flagsInputArray.join(', ')} added to guide ${guideid} successfully.`);
					
					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), true);

					return;
				})
				.catch(function(error)
				{
					log(`Failed to edit guide ${guideid} (${error})`);
	
					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
	
					return;
				})
				.finally(function()
				{
					// end of loop
					if (attempted === loadList.length)
					{
						stylePopup(guideCount);
					}
					// loop wholly successful
					if (guideCount === loadList.length)
					{
						markCompletion(flagsInput, true);
					}
				});
			}
			catch(error)
			{
				log(`Failed to retrieve guide ${guideid} (${error})`);
				
				markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
			}
		}

		return;
	})
	.catch(function(error)
	{
		log(`Couldn't get list of available flags ${error}`);

		markCompletion(flagsInput, false);
		
		return;
	});

	return;
}

/**	REMOVE FLAG(S) FROM GUIDES
 * @param {PointerEvent|Array} e either the click event from button or array of flagid's from another function
 * @param {Int} g 0 if function is called from button click or guideid if called from another function
 * @returns
 */
async function removeFlags(e, g = 0)
{
	let
	funcOrigin		= -1,			// -1: not yet defined, 0: from button, 1: from another function
	flagsInput		= document.getElementById('flags'),		// input text field
	flagsInputArray = [];			// array of strings containing flagid's to remove

	// if this func was called from a button press
	if (e instanceof PointerEvent)
	{
		funcOrigin = 0;

		let flagsValue = flagsInput.value;

		if (flagsValue === '')
		{
			markCompletion(flagsInput, false);
			return;
		}

		flagsInputArray = flagsValue.split(/\s*,\s*/);
	}
	// or if this func was called from another func
	else if (Array.isArray(e) && g !== 0)
	{
		funcOrigin = 1;

		flagsInputArray = e;
	}


	/**	This is the explicit function to remove flags from the guide
	 * @param {Int} id guideid
	 * @returns 
	 */
	var r = async (id) =>
	{
		// get available flags
		try
		{
			let flagsObj = await xhr_get('user', 'flags');
			
			const flags = Object.values(flagsObj['guide']);

			// filters out the flags that aren't real flags
			flagsInputArray = flags.map(f =>
			{
				if (flagsInputArray.includes(f['flagid'])) {
					return f['flagid'];
				}
				return undefined;
			})
			.filter(f => f !== undefined);

			if (flagsInputArray.length === 0)
			{
				log(`No flags found from the provided input.`);

				markCompletion(flagsInput, false);
				return;
			}


			// retrieve this guide object
			try
			{
				let guideObj = await xhr_get('guides', id);

				let
				revisionId 		= guideObj['revisionid'], 	// this guide's revisionid
				guideFlags 		= guideObj['flags'].map(f => f['flagid']), 	// array of flagids in this guide
				newGuideFlags	= guideFlags.filter(f => !flagsInputArray.includes(f));
				flagsToDo		= guideFlags.filter(f => flagsInputArray.includes(f));

				// if the guide doesn't contain any flags attempted to remove
				if (flagsToDo.length === 0)
				{
					log(`Guide ${id} doesn't have any of the specified flags.`);
					return;
				}

				const
				params	= { 'revisionid': revisionId },
				data	= { 'flags': newGuideFlags };

				// edit the flags
				try
				{
					await xhr_edit('PATCH', id, null, params, data);

					log(`Flag(s) ${flagsToDo.join(', ')} removed from guide ${id} successfully.`);

					markCompletion(loadListUl.querySelector(`[data-id="${id}"]`), true);

					return true;
				}
				catch(error)
				{
					log(`Error editing guide ${id} (${error})`);

					markCompletion(loadListUl.querySelector(`[data-id="${id}"]`), false);
				}
			}
			// couldn't retrieve the flags in the specific guide
			catch (error)
			{
				log(`Couldn't retrieve flags from guide ${id} (${error})`);

				// style the list items red that couldn't be retrieved at all (if button was clicked)
				if (funcOrigin === 0)
				{
					markCompletion(loadListUl.querySelector(`[data-id="${id}"]`), false);
				}

				return false;
			}
		}
		// couldn't get available flags
		catch
		{
			log(`Couldn't get list of available flags ${error}`);

			markCompletion(flagsInput, false);

			return false;
		}
	};


	// If button was clicked, call the removal on every guide in the list
	if (g === 0)
	{
		let
		guideCount	= 0,
		attempted	= 0;

		for (const guideid of loadList)
		{
			attempted++;
			// r returns with true if successful
			try
			{
				if (await r(guideid))
				{
					guideCount++;
				}
			}
			catch(e)
			{
				console.log(new Error(e));
			}
		}

		// if loop is finished
		if (attempted === loadList.length)
		{
			stylePopup(guideCount);
		}
		// if all guides were successful
		if (guideCount === loadList.length)
		{
			markCompletion(flagsInput, true);
		}
	}
	// If another function called this, then just call the removal on the specified guide
	else
	{
		await r(g);
	}

	return;
}

/** ADD OR REMOVE TAG(S) WITH GUIDES
 * 	allows adding multiple bases on comma separated input
 * @param {PointerEvent} e click event from button
 */
async function editTags(e)
{
	// check that the clicked button exists
	if (!e || !e.target)
	{
		return;
	}

	let operation;	// true: add tags, false: remove tags

	// these are based on the html id of the button click that called this function
	if (e.target.id === 'tags-add')
	{
		operation = true;
	}
	if (e.target.id === 'tags-remove')
	{
		operation = false;
	}

	// this function is special, as it both adds/removes either single or mutiple tags. thus, an object is required to keep track of each guide's success
	let done = {};

	// format {12345: true|false}
	for (const g of loadList)
	{
		done[g] = false;
	}

	let
	tagsInput		= document.getElementById('tags'),
	tagsValue		= tagsInput.value,
	tagsInputArray	= tagsValue.split(/\s*,\s*/),
	attempted		= 0;

	// empty input
	if (tagsValue === '')
	{
		markCompletion(tagsInput, false);
		return;
	}


	for (const guideid of loadList)
	{
		attempted++;

		let tagsToDo = [];

		// check if this guideid has any of the tagsInputArray, and only loop in the non-overlapping tags
		try
		{
			const existingTags = await xhr_get('guides', `${guideid}/tags`);

			// if adding tags, make sure they aren't already in the guide
			if (operation)
			{
				tagsToDo = tagsInputArray.filter(t => !existingTags.includes(t));
			}
			// if removing, make sure all of the tags are in the guide
			if (!operation)
			{
				tagsToDo = tagsInputArray.filter(t => existingTags.includes(t));
			}
		}
		catch(error)
		{
			log(`Couldn't retrieve existing tags in guide ${guideid} (${error})`);
		}

		// loop through each tag to add or remove
		for (const tag of tagsToDo)
		{
			const data = {'tag': tag};

			try
			{
				const g = await xhr_edit(operation ? 'PUT' : 'DELETE', guideid, 'tag', null, data);

				if (g)
				{
					log(`Tag "${tag}" ${operation ? 'added to' : 'removed from'} guide ${guideid}`);
	
					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), true);
	
					// record if any tag edit was successful for this one guide
					done[guideid] = true;
				}
				else
				{
					log(`Error ${operation ? 'adding' : 'removing'} tag "${tag}" with guide ${guideid} (Unknown Error)`);

					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
				}
			}
			catch(error)
			{
				log(`Error ${operation ? 'adding' : 'removing'} tag "${tag}" with guide ${guideid} (${error})`);
				
				markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
			}
		}

		// to finish off the loop, record the successful guides using the done object
		if (attempted === loadList.length)
		{
			const successful = Object.values(done).filter(t => t === true);
			stylePopup(successful.length);

			if (!Object.values(done).includes(false))
			{
				markCompletion(tagsInput, true);
			}
		}
	}

	return;
}

/**	ADD OR REMOVE TEAMS FROM PRIVATE GUIDES
 *  
 * @param {PointerEvent} e click event from button
 */
function editTeams(e)
{
	// operation is based on the button html id that clicked
	// true: add, false: remove
	let operation;

	if (e.target.id === 'groups-add')
	{
		operation = true;
	}
	if (e.target.id === 'groups-remove')
	{
		operation = false;
	}

	let
	groupsInput	= document.getElementById('groups'),
	groupsValue	= groupsInput.value;

	// teamIDs are like guideids
	if (!groupsValue.match(/^\d+$/gi))
	{
		log(`Team ID isn't valid.`);

		markCompletion(groupsInput, false);
		return;
	}

	groupsValue = parseInt(groupsValue);

	xhr_get('teams', groupsValue)
	.then(function(teamObj)
	{
		// if the team exists
		if (teamObj && teamObj.length > 0)
		{
			log(`Found team ${groupsValue}.`);

			let
			attempted	= 0,
			guideCount	= 0;

			for (const guideid of loadList)
			{
				attempted++;

				xhr_edit(operation ? 'PUT' : 'DELETE', guideid, `teams/${groupsValue}`, null, null)
				.then(function(t)
				{
					if (t)
					{
						guideCount++;

						log(`Edited guide ${guideid} successfully.`);
						
						markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), true);
					}
					else
					{
						log(`Couldn't edit guide ${guideid} (Unknown Error)`);

						markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
					}

					return;
				})
				.catch(function(error)
				{
					log(`Couldn't edit guide ${guideid} (${error})`);
					
					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);

					return;
				})
				.finally(function()
				{
					// end of loop
					if (attempted === loadList.length)
					{
						stylePopup(guideCount);
					}

					// fully successful loop
					if (guideCount === loadList.length)
					{
						markCompletion(groupsInput, true);
					}
				});
			}

			return;
		}
	})
	.catch(function(error)
	{
		log(`Couldn't retrieve team ${groupsValue} (${error})`);

		markCompletion(groupsInput, false);

		return;
	});

	return;
}

/**	ADD OR REMOVE TOOL OR PART. DON'T USE IF GUIDES HAVE A TYPE OF ITEM, SINCE API BUG REVERTS TO DEFAULT TYPE OF ITEM
 * 
 * @param {PointerEvent} e click event from button
 */
function editTP(e)
{
	// just double checking
	if (!e || !e.target)
	{
		return;
	}

	let
	tp = '',	// tools|parts
	operation;	// true|false

	if (e.target.id === 'parts-add')
	{
		tp = 'parts';
		operation = true;
	}
	if (e.target.id === 'parts-remove')
	{
		tp = 'parts';
		operation = false;
	}

	if (e.target.id === 'tools-add')
	{
		tp = 'tools';
		operation = true;
	}
	if (e.target.id === 'tools-remove')
	{
		tp = 'tools';
		operation = false;
	}

	let
	tpInput		= document.getElementById(tp),			// input field for the tool or part
	tpValue		= tpInput.value,						// raw search string
	tpSuggest	= tpValue.replaceAll(' ', '%20'),		// url-compatible search string
	optional	= document.getElementById(`${tp}Optional`).checked;		// optional checkbox

	// clean up stray query parameters like ?revisionid=HEAD
	tpSuggest	= tpSuggest.replace(/\?.*$/, '');

	
	if (tpValue === '')
	{
		markCompletion(tpInput, false);
		return;
	}


	// Instead of relying on the text field being perfectly accurate,
	// search and return the first result
	xhr_get('suggest', `${tpSuggest}?doctypes=item`)
	.then(function(responseObj)
	{
		if (!responseObj)
		{
			markCompletion(tpInput, false);
			return;
		}

		let
		attempted	= 0,
		guideCount	= 0,
		resultObj	= responseObj['results'][0];	// the search result from the input field

		for (const guideid of loadList)
		{
			attempted++;

			xhr_get('guides', guideid)
			.then(function(guideObj)
			{
				let tpArray = [];

				// existing guide tools or parts
				guideObj[tp].map(function(t)
				{
					tpArray.push(
					{
						'type': t['type'],
						'quantity': parseInt(t['quantity']),
						'name': t['text'],
						'notes': typeof t['notes'] === 'string' ? t['notes'] : '',
						'isoptional': t['isoptional']
					});
				});

				// add a tool to the existing tools or parts
				if (operation)
				{
					tpArray.push(
					{
						'type': '',
						'quantity': 1,
						'name': resultObj['title'],
						'notes': '',
						'isoptional': optional
					});
				}
				// remove the tool from the existing tools
				else
				{
					tpArray = tpArray.filter(t => t['name'] !== resultObj['title']);
				}

				const
				revisionId	= guideObj['revisionid'],
				params		= {'revisionid': revisionId};

				let data = {};

				if (tp === 'tools')
				{
					data = {'tools': tpArray};
				}
				if (tp === 'parts')
				{
					data = {'parts': tpArray};
				}

				xhr_edit('PATCH', guideid, null, params, data)
				.then(function(g)
				{
					if (g)
					{
						guideCount++;
	
						log(`Edited ${resultObj['title']} in guide ${guideid} successfully.`);
	
						markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), true);
					}
					else
					{
						log(`Couldn't edit guide ${guideid} (Unknown Error)`);

						markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
					}

					return;
				})
				.catch(function(error)
				{
					log(`Couldn't edit guide ${guideid} (${error})`);

					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);

					return;
				})
				.finally(function()
				{
					// loop completes
					if (attempted === loadList.length)
					{
						stylePopup(guideCount);
					}
					// loop wholly successful
					if (guideCount === loadList.length)
					{
						markCompletion(tpInput, true);
					}
				});

				return;
			})
			.catch(function(error)
			{
				log(`Couldn't retrieve guide ${guideid} (${error})`);

				markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);

				return;
			});
		}
	})
	.catch(function(error)
	{
		log(`Tool search validation failed (${error})`);

		markCompletion(tpInput, false);

		return;
	})
}
	
/**	ADD A PREREQ AFTER A SPECIFIC PRECEDING PREREQ OR AT THE BEGINNING OF THE PREREQS
 * 	
 * @param {PointerEvent} e click event from button
 */
async function editPrereq(e)
{
	// check that the clicked button exists
	if (!e || !e.target)
	{
		return;
	}

	let operation;	// true: add prereq, false: remove prereq

	// these are based on the html id of the button click that called this function
	if (e.target.id === 'prereq-add')
	{
		operation = true;
	}
	if (e.target.id === 'prereq-remove')
	{
		operation = false;
	}

	const
	precedingInput	= document.getElementById('prereq-preceding'),	// input field for guideid to insert new prereq after
	precedingValue	= precedingInput.value,							// string value of above
	prereqInput		= document.getElementById('prereq'),			// input field for prereq guideid to insert
	prereqValue		= prereqInput.value;							// string value of above

	let validPrereq	= false;	// records if the entered prereq is a real guide

	// only valid preceding input is empty or digits
	if (!precedingValue.match(/^\d*$/))
	{
		log(`Preceding prerequisite must be a guide ID or empty.`);

		markCompletion(precedingInput, false);

		return;
	}
	// only valid prereq input is digits
	if (prereqValue.match(/^\d+$/))
	{
		validPrereq = true;
	}
	else
	{
		log(`Prerequisite must be a valid guide ID.`);

		markCompletion(prereqInput, false);

		return;
	}

	// just to warn the user of what they're doing
	if (!operation && precedingValue !== '')
	{
		log(`Don't include a preceding guide if you're trying to remove a prerequisite.`);

		markCompletion(precedingInput, false);
		
		return;
	}

	// get the prereq to see if its a real guide
	try
	{
		let g = await xhr_get('guides', parseInt(prereqValue));

		if (g)
		{
			validPrereq = true;
		}
		else
		{
			validPrereq = false;
		}
		
	}
	catch(error)
	{
		log(`Couldn't retrieve prerequisite ${prereqValue} (${error})`);

		validPrereq = false;
	}


	if (!validPrereq)
	{
		log(`Prerequisite must be a valid guide ID.`);

		markCompletion(prereqInput, false);
		
		return;
	}


	let
	attempted	= 0,
	guideCount	= 0;

	for (const guideid of loadList)
	{
		attempted++;
		
		xhr_get('guides', guideid)
		.then(function(guideObj)
		{
			let
			precedingId		= precedingValue === '' ? 0 : parseInt(precedingValue),	// preceding is 0 or the integer of the input field
			prereqId		= parseInt(prereqValue),								// prereq is just the integer of the input field
			guidePrereqs	= guideObj['prerequisites'].map(p => p['guideid']);		// array of existing prereq guideids

			// check if the preceding exists in the prereqs or is 0 (only applies to adding prereqs)
			if (operation && !guidePrereqs.includes(precedingId) && precedingId !== 0)
			{
				log(`Guide ${guideid} doesn't contain prerequisite ${precedingId}`);

				markCompletion(prereqInput, false);
				
				return;
			}
			if (!operation && !guidePrereqs.includes(prereqId))
			{
				log(`Guide ${guideid} doesn't contain prerequisite ${prereqId}`);

				markCompletion(prereqInput, false);
				
				return;
			}

			// the index to insert the new prereq is after the preceding id, or at the beginning of the array
			let precedingIndex = precedingId === 0 ? 0 : guidePrereqs.indexOf(precedingId) + 1;

			// adding the prereq
			if (operation)
			{
				guidePrereqs.splice(precedingIndex, 0, prereqId);	// "dew it" (deleteCount is 0 and new element is the third arg)
			}
			// removing the prereq
			if (!operation)
			{
				guidePrereqs.splice(guidePrereqs.indexOf(prereqId), 1); // remove the prereq input from the existing guides
			}

			const
			revisionId	= guideObj['revisionid'],
			params		= {'revisionid': revisionId},
			data		= {'prerequisites': guidePrereqs}

			xhr_edit('PATCH', guideid, null, params, data)
			.then(function(g)
			{
				if (g)
				{
					guideCount++;
	
					log(`Edited prerequisite ${prereqId} in guide ${guideid} successfully`);

					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"`), true);
				}
				else
				{
					log(`Couldn't edit prerequisite ${prereqId} in guide ${guideid} (Unknown Error)`);

					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"`), false);
				}

				return;
			})
			.catch(function(error)
			{
				log(`Couldn't edit prerequisite ${prereqId} in guide ${guideid} (${error})`);

				markCompletion(loadListUl.querySelector(`[data-id="${guideid}"`), false);

				return;
			})
			.finally(function()
			{
				// end of loop
				if (attempted === loadList.length)
				{
					stylePopup(guideCount);
				}
				// loop wholly successful
				if (guideCount === loadList.length)
				{
					markCompletion(prereqInput, true);
				}
			});

			return;
		})
		.catch(function(error)
		{
			log(`Couldn't retrieve guide ${guideid} (${error})`);

			markCompletion(loadListUl.querySelector(`[data-id="${guideid}"`), false);

			return;
		});
	}
}

/**	CHANGE THE CATEGORY OF A GUIDE
 * 
 */
async function changeCategory()
{
	let
	catInput	= document.getElementById('category'),
	catValue	= catInput.value;

	if (catValue === '')
	{
		markCompletion(catInput, false);
		return;
	}

	// Check if the category entered exists
	try
	{
		let c = await xhr_get('wikis/CATEGORY', catValue);

		if (!c)
		{
			log(`Couldn't retrieve category ${catValue}`);

			markCompletion(catInput, false);
		}

		let
		attempted	= 0,
		guideCount	= 0;

		for (const guideid of loadList)
		{
			attempted++;

			// Get attributes about this guide
			xhr_get('guides', guideid)
			.then(function(guideObj)
			{
				const
				existingCat	= guideObj['category'];
	
				// check if the guide is already in that category
				if (existingCat === catValue)
				{
					log(`Guide ${guideid} is already in category ${catValue}.`);

					return;
				}
	
				const
				revisionId	= guideObj['revisionid'],
				params		= {'revisionid': revisionId};
	
				let data	= {'category': catValue};
	
				// Update the guide category
				xhr_edit('PATCH', guideid, null, params, data)
				.then(function(g)
				{
					guideCount++;

					log(`Updated guide ${guideid} category to ${catValue} successfully.`);
	
					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), true);
	
					return;
				})
				.catch(function(error)
				{
					log(`Couldn't update guide ${guideid} category (${error})`);
	
					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
	
					return;
				})
				.finally(function()
				{
					// end of loop
					if (attempted === loadList.length)
					{
						stylePopup(guideCount);
					}
					// loop wholly successful
					if (guideCount === loadList.length)
					{
						markCompletion(catInput, true);
					}
				});
			})
			.catch(function(error)
			{
				log(`Couldn't retrieve guide ${guideid} (${error})`);

				markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
	
				return;
			});
		}
	}
	catch(error)
	{
		log(`Category not found (${error})`);

		markCompletion(catInput, false);
	}

	return;
}

/** FIND AND REPLACE TEXT IN INTRODUCTIONS
 * 
 */
async function introReplace()
{
	let
	findDiv = document.getElementById('intro-find'),
	findVal = findDiv.value,
	replaceDiv = document.getElementById('intro-replace'),
	replaceVal = replaceDiv.value;

	if (findVal === '')
	{
		markCompletion(findDiv, false);
		return;
	}
	if (replaceVal === '')
	{
		markCompletion(replaceDiv, false);
		return;
	}

	let
	attempted	= 0,
	guideCount	= 0;

	for (const guideid of loadList)
	{
		attempted++;

		try
		{
			let guideObj = await xhr_get('guides', guideid);

			const
			revisionId = guideObj['revisionid'],
			originalStr = guideObj['introduction_raw'],
			newStr = originalStr.replaceAll(findVal, replaceVal),
			params = {'revisionid': revisionId},
			data = {'introduction': newStr};

			xhr_edit('PATCH', guideid, null, params, data)
			.then(function(g)
			{
				guideCount++;

				log(`Phrases replaced in guide ${guideid} successfully.`);
				
				markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), true);

				return;
			})
			.catch(function(error)
			{
				log(`Failed to edit guide ${guideid} (${error})`);

				markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);

				return;
			})
			.finally(function()
			{
				// end of loop
				if (attempted === loadList.length)
				{
					stylePopup(guideCount);
				}
				// loop wholly successful
				if (guideCount === loadList.length)
				{
					markCompletion(replaceDiv, true);
				}
			});
		}
		catch(error)
		{
			log(`Failed to retrieve guide ${guideid} (${error})`);
			
			markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
		}
	}
	return;
}

/**	REMOVE IN_PROGRESS FLAG AND PUBLISH GUIDES
 * 
 * @param {PointerEvent} e click event from button
 */
async function publish(e)
{
	let
	operation,
	targetId = e && e.target ? e.target.id : 'edit';

	if (targetId === 'publish')
	{
		operation = true;
	}
	if (targetId === 'unpublish')
	{
		operation = false;
	}

	let
	attempted	= 0,
	guideCount	= 0;

	for (let guideid of loadList)
	{
		attempted++;

		try
		{
			let guideObj = await xhr_get('guides', guideid);

			const
			revisionid	= guideObj['revisionid'],
			params		= {'revisionid': revisionid},
			data		= {'public': operation};

			try
			{
				let g = await xhr_edit('PATCH', guideid, null, params, data);

				if (g)
				{
					guideCount++;

					log(`${targetId}ed guide ${guideid} successfully.`);

					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), true);
					
					if (operation)
					{
						removeFlags(['GUIDE_IN_PROGRESS'], guideid);
					}
				}
				else
				{
					log(`Couldn't ${targetId} guide ${guideid} (Unknown Error)`);
				
					markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
				}
			}
			catch(error)
			{
				log(`Couldn't ${targetId} guide ${guideid} (${error})`);
				
				markCompletion(loadListUl.querySelector(`[data-id="${guideid}"]`), false);
			}
		}
		catch(error)
		{
			log(`Couldn't retrieve Guide ${guideid} info (${error})`);
		}
		finally
		{
			if (attempted === loadList.length)
			{
				stylePopup(guideCount);
			}
		}
	}

	return;
}

/**	REVEAL THE POPUP AND DISPLAY HOW MANY GUIDES WERE EDITED
 * 
 * @param {Int} edited number of guides edited
 */
function stylePopup(edited)
{
	styleLoading(popup, true);
	popupTxt.innerHTML = edited;
	setTimeout(() =>
	{
		styleLoading(popup, false);
		popupTxt.innerHTML = 0;
	},
	1234);
}


/**	Handles, well... everything
 * @param {str} method 
 * @param {int} guideid 
 * @param {str|null} urlExt 
 * @param {obj|null} params 
 * @param {obj|null} data 
 * @returns Promise
 */
function xhr_edit(method, guideid, urlExt, params, data)
{
	if (authInput.value === '')
	{
		log(`Enter a valid authentication token.`);
		markCompletion(authInput, false);
		return;
	}
	
	let paramsStr = '';

	if (params !== null)
	{
		let paramsArray = [];

		for (let p in params)
		{
			let string = `${p}=${params[p]}`;
			paramsArray.push(string);
		}

		paramsStr = `?${paramsArray.join('&')}`;
	}
	// paramStr = '' or '?a=b&c=d&e=f'


	let url = `${apiUrl}guides/${guideid}`;

	if (urlExt !== null)
	{
		url = `${url}/${urlExt}`;
	}
	// url	= https://www.ifixit.com/api/2.0/guides/123456
	//	or	  https://www.ifixit.com/api/2.0/guides/123456/string	

	document.querySelector('html').classList.add('windowLoading');

	return new Promise(function(resolve, reject)
	{
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function()
		{

			if (xhr.readyState === 4)
			{
				
				document.querySelector('html').classList.remove('windowLoading');

				if (xhr.status === 200 || xhr.status === 201)
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
		xhr.onerror = function()
		{
			document.querySelector('html').classList.remove('windowLoading');

			reject(new Error('Unknown network error'));
		}

		xhr.open(method, url+paramsStr, true);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.setRequestHeader('X-App-Id', 'be0ef8241c0be993ae73c407e6c536b9');
		xhr.setRequestHeader('Authorization', `api ${authInput.value}`);
		
		if (data !== null)
		{
			xhr.send(JSON.stringify(data));
		}
		else
		{
			xhr.send();
		}
	});
}

document.addEventListener('DOMContentLoaded', function()
{
	document.getElementById('flags-add').addEventListener('click', 				addFlags);
	document.getElementById('flags-remove').addEventListener('click', 			removeFlags);
	document.getElementById('tags-add').addEventListener('click', 				editTags);
	document.getElementById('tags-remove').addEventListener('click', 			editTags);
	document.getElementById('groups-add').addEventListener('click', 			editTeams);
	document.getElementById('groups-remove').addEventListener('click', 			editTeams);
	document.getElementById('tools-add').addEventListener('click', 				editTP);
	document.getElementById('tools-remove').addEventListener('click', 			editTP);
	document.getElementById('parts-add').addEventListener('click', 				editTP);
	document.getElementById('parts-remove').addEventListener('click', 			editTP);
	document.getElementById('prereq-add').addEventListener('click', 			editPrereq);
	document.getElementById('prereq-remove').addEventListener('click', 			editPrereq);
	document.getElementById('category-replace').addEventListener('click', 		changeCategory);
	document.getElementById('intro-change').addEventListener('click', 			introReplace);
	document.getElementById('publish').addEventListener('click', 				publish);
	document.getElementById('unpublish').addEventListener('click', 				publish);
});