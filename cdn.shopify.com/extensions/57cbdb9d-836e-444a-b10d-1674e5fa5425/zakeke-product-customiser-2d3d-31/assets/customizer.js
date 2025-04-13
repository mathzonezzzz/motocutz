/*******************************************************
 * Copyright (C) 2021 Zakeke
 *
 * This file is part of Zakeke.
 *
 * Zakeke can not be copied and/or distributed without the express
 * permission of Zakeke
 *******************************************************/
function zakekeDesigner(config) {
	function toShopifyPrice(price) {
		return price.toFixed(2) * 100;
	}

	function fromShopifyPrice(price) {
		if (price > 0) {
			return price / 100;
		}
		return price;
	}

	function isInsideShopney() {
		return (
			(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.zakekeAddToCartHandler) ||
			(window.Android && window.Android.zakekeAddToCart)
		);
	}

	function getCartTransformProperties(design) {
		return {
			_customization: design,
			_zakekeMode: isCartTransformPlusEnabled() ? 'update' : 'expand'
		}
	}

	function getPreviewPropertyName() {
		if (isCartTransformPlusEnabled()) {
			return 'Preview';
		}

		return 'Preview';
	}

	function getCartTransformPriceProperties(price) {
		if (price === 0) {
			return {};
		}

		if (isCartTransformPlusEnabled()) {
			return {
				_zakekeDesignUnitPrice: price.toFixed(2)
			};
		} else if (isCartTransformEnabled() && price > 0 && getZakekePricingData()) {
			return {
				_zakekeFeeProduct: 'gid://shopify/ProductVariant/' + getZakekePricingData().variantId,
				_zakekeDesignUnitPrice: price.toFixed(2),
				_configurationPrice: toShopifyPrice(price)
			};
		} else {
			return {};
		}
	}

	function shopneyAddToCart(productId, variantId) {
		if (window.Android) {
			window.Android.zakekeAddToCart(productId, variantId);
		} else {
			window.webkit.messageHandlers.zakekeAddToCartHandler.postMessage('{"product_id":' + productId + ', "variant_id":' + variantId + '}');
		}
	}

	function shopneyAddToCartMultiple(products) {
		const productsJson = JSON.stringify(products);
		if (window.Android) {
			window.Android.zakekeMultipleAddToCart(productsJson);
		} else {
			window.webkit.messageHandlers.zakekeMultipleAddToCartHandler.postMessage(productsJson);
		}
	}

	function getShopLocale() {
		if (window.zakekeShopLocales) {
			return window.zakekeShopLocales.find(
				(c) => c.iso_code === config.locale || c.iso_code.split('-')[0] === config.locale || c.iso_code.split('-')[0] === config.locale.split('-')[0]
			);
		}
	}

	function localizeAddToCartFormAction(form) {
		const shopLocale = getShopLocale();

		if (shopLocale && !shopLocale.primary && !form.action.startsWith('http')) {
			form.action = form.action.replace('/cart/add', shopLocale.root_url + '/cart/add');
		}
	}

	function buildDirectDownloadUrl(design, modificationID) {
		const zipUrl = new URL(config.zakekeUrl + 'integration/shopify/download');
		zipUrl.searchParams.append('designDocID', design);
		zipUrl.searchParams.append('code', window.zakekeCustomerId || getVisitorCode());
		zipUrl.searchParams.append('shop', config.shop);

		if (modificationID) {
			zipUrl.searchParams.append('modificationID', modificationID);
		}

		return zipUrl.toString();
	}

	function buildDirectSummaryDownloadUrl(design, modificationID) {
		const url = new URL(config.zakekeUrl + 'integration/shopify/download');
		url.searchParams.append('designDocID', design);
		url.searchParams.append('code', window.zakekeCustomerId || getVisitorCode());
		url.searchParams.append('format', 'summary');

		if (modificationID) {
			url.searchParams.append('modificationID', modificationID);
		}

		return url.toString();
	}

	function postprocessProperties(properties, context) {
		if (!window.zakekePostprocessProperties) {
			return Promise.resolve(properties);
		}

		return Promise.resolve(
			window.zakekePostprocessProperties(
				properties,
				Object.assign({}, context, {
					price: customizationPrice
				})
			)
		);
	}

	function isOptismiticEnabled() {
		return customizationPrice === 0 && config.customizationStrategy === 1;
	}

	function isCartTransformEnabled() {
		return (config.customizationStrategy === 3 || isCartTransformPlusEnabled()) && !isInsideShopney();
	}

	function isCartTransformPlusEnabled() {
		return config.customizationStrategy === 4 && !isInsideShopney();
	}

	function toShopifyPreviews(previews) {
		return previews.reduce((acc, preview, idx) => acc + preview.url + '#' + preview.sideName + (idx + 1 === previews.length ? '' : ','), '');
	}

	function getZakekePricingData() {
		return window.zakekePricingData;
	}

	function enableClientPreviews(iframeUrls) {
		iframeUrls.customizerLargeUrl = iframeUrls.customizerLargeUrl + '&isClientPreviewsEnabled=1';
		iframeUrls.customizerSmallUrl = iframeUrls.customizerSmallUrl + '&isClientPreviewsEnabled=1';
	}

	function checkStartImage(iframeUrls) {
		try {
			const hashSearch = Object.fromEntries(new URLSearchParams(window.location.hash.substring(1)));
			if (!hashSearch.startImageUrl) {
				return;
			}

			const customizerLargeUrlSearch = new URLSearchParams(iframeUrls.customizerLargeUrl);
			const customizerSmallUrlSearch = new URLSearchParams(iframeUrls.customizerSmallUrl);

			customizerLargeUrlSearch.set('startImageUrl', hashSearch.startImageUrl);
			customizerSmallUrlSearch.set('startImageUrl', hashSearch.startImageUrl);

			iframeUrls.customizerLargeUrl = iframeUrls.customizerLargeUrl.split('?')[0] + '?' + customizerLargeUrlSearch.toString();
			iframeUrls.customizerSmallUrl = iframeUrls.customizerSmallUrl.split('?')[0] + '?' + customizerSmallUrlSearch.toString();
		} catch (e) {
			console.error(e);
		}
	}

	function findVariant(variantID) {
		const variant = config.product.variants.find((x) => x.id == variantID);

		if (variant == null) {
			throw new Error(`Unable to find variant: ${variantID}`);
		}

		return variant;
	}

	function exactMatchVariant(color) {
		const currentVariant = findVariant(config.variantId);

		if (!color || color.length === 0) {
			return currentVariant;
		}

		const options = [1, 2, 3].map((i) => {
			const colorForOption = color.find((c) => c.Id == i);

			if (colorForOption) {
				return colorForOption.Value.Id;
			}

			const currentVariantOption = currentVariant.options[i - 1];
			if (currentVariantOption) {
				return currentVariantOption.value;
			}

			return undefined;
		});

		return config.product.variants.find((v) => options.every((c, i) => {
			const option = v.options[i];
			return !option || option.value === c;
		}));
	}

	function matchVariant(color) {
		return exactMatchVariant(color) || findVariant(config.variantId);
	}

	function isInStock(variant, quantity) {
		return variant.inventoryPolicy === 'CONTINUE'
			|| (variant.inventoryItem && variant.inventoryItem.tracked && variant.sellableOnlineQuantity >= quantity)
			|| variant.availableForSale;
	}

	function calculatePriceConditionPercentage(condition, productPrice) {
		if (condition.priceType === 1) {
			return productPrice * (condition.priceToAdd / 100) * condition.multiplier;
		}

		return 0;
	}

	function calculateZakekePrice(price, zakekePercentPrice, zakekePrice, conditions, qty) {
		let finalPrice = zakekePrice;

		if (zakekePercentPrice) {
			finalPrice += price * (zakekePercentPrice / 100);
		}

		if (conditions) {
			finalPrice += conditions.reduce((acc, c) => acc + calculatePriceConditionPercentage(c, price * qty), 0);
		}

		return finalPrice;
	}

	function calculateZakekeUnitPrice(zakekePrice, zakekePricingModel, qty) {
		if (zakekePrice === 0) {
			return zakekePrice;
		}

		return zakekePrice / qty;
	}

	function calculatePrice(price, zakekeLinePrice, quantity) {
		return price * quantity + zakekeLinePrice;
	}

	function productData(color, zakekeOptions) {
		const variant = window.zakekeNotExactMatchVariant ? matchVariant(JSON.parse(color)) : exactMatchVariant(JSON.parse(color));

		if (!variant) {
			iframe.contentWindow.postMessage(
				{
					data: {
						color: color,
						isOutOfStock: true,
						finalPrice: 0
					},
					zakekeMessageType: 'DesignChange'
				},
				'*'
			);

			return;
		}

		const zakekePrice = calculateZakekePrice(
			variant.price,
			zakekeOptions['zakeke-percent-price'],
			zakekeOptions['zakeke-price'],
			zakekeOptions['zakeke-conditions'],
			config.quantity
		);

		customizationPrice = calculateZakekeUnitPrice(zakekePrice, zakekeOptions['zakeke-pricing-model'], config.quantity);

		iframe.contentWindow.postMessage(
			{
				data: {
					color: color,
					isOutOfStock: !isInStock(variant, config.quantity),
					finalPrice: config.priceHide ? 0 : calculatePrice(variant.price, zakekePrice, config.quantity)
				},
				zakekeMessageType: 'DesignChange'
			},
			'*'
		);
	}

	function productPrice(data) {
		const variant = matchVariant(data.attributes);

		const zakekePrice = calculateZakekePrice(variant.price, data.percentPrice, Number.isNaN(data.price) ? 0 : data.price, data.conditions, data.quantity);

		if (data.includePricing) {
			customizationPriceMultiple = calculateZakekeUnitPrice(zakekePrice, data.pricingModel, data.quantity);
		}

		iframe.contentWindow.postMessage(
			{
				data: {
					promiseId: data.promiseId,
					isOutOfStock: !isInStock(variant, data.quantity),
					finalPrice: calculatePrice(variant.price, zakekePrice, data.quantity)
				},
				zakekeMessageType: 'ProductPrice'
			},
			'*'
		);
	}

	function productAttributes(data) {
		const attributes = config.product.options.map((option) => ({
			id: option.position.toString(),
			label: option.name,
			values: option.values.map((val) => ({
				id: val,
				label: val
			}))
		}));
		const variants = config.product.variants.map((variant) =>
			[1, 2, 3]
				.filter((i) => variant.options[i - 1])
				.map((i) => ({
					Id: i.toString(),
					Value: {
						Id: variant.options[i - 1].value
					}
				}))
		);
		iframe.contentWindow.postMessage(
			{
				data: Object.assign({}, data, {
					attributes,
					variants
				}),
				zakekeMessageType: 'ProductAttributes'
			},
			'*'
		);
	}

	function getCart() {
		return fetch('/cart.json?t=${new Date().getTime()}').then((res) => res.json());
	}

	function ajaxAddToCart(items) {
		return fetch('/cart/add.json', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ items })
		});
	}

	async function formAddToCart(items) {
		const form = document.getElementById('zakeke-addtocart');
		localizeAddToCartFormAction(form);

		for (const item of items) {
			const body = new FormData(form);

			Object.keys(item.properties).forEach(p => {
				body.set(`properties[${p}]`, item.properties[p]);
			});

			body.set('id', item.id);
			body.set('quantity', item.quantity);

			await fetch(form.action, {
				method: 'POST',
				body: body
			});
		}
	}

	async function cartTransformAddToCart(items) {
		const form = document.getElementById('zakeke-addtocart');
		localizeAddToCartFormAction(form);

		for (const item of items) {
			await fetch(item.properties['_previews']).then(res => res.blob()).then(previewImg => {
				const body = new FormData(form);

				Object.keys(item.properties).forEach(p => {
					body.set(`properties[${p}]`, item.properties[p]);
				});

				body.set(`properties[${getPreviewPropertyName()}]`, previewImg, 'Preview.png');

				body.set('id', item.id);
				body.set('quantity', item.quantity);

				return fetch(form.action, {
					method: 'POST',
					body: body
				});
			});
		}
	}

	function ajaxRemoveFromCart(cartItem) {
		return fetch('/cart/change.json', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				id: cartItem.key,
				quantity: 0
			})
		});
	}

	function checkProduct(product, numTry = 1) {
		if (window.location.hostname.includes('shopifypreview.com')) {
			return new Promise((resolve) => {
				setTimeout(() => {
					resolve(product);
				}, 1500);
			});
		}

		return new Promise((resolve) => {
			setTimeout(() => {
				fetch(`/products/${product.handle}.json?t=${new Date().getTime()}`, {
					credentials: 'same-origin'
				}).then((res) => {
					if (res.ok || numTry >= 3) {
						setTimeout(() => {
							resolve(product);
						}, 2500);
					} else {
						setTimeout(() => resolve(checkProduct(product, numTry + 1)), 1000);
					}
				});
			}, 1500);
		});
	}

	function createProduct(designID, variantID, includeTags, excludeCustomizationPrice, qty, modificationID) {
		return fetch(config.zakekeApiUrl + 'shopify/designs', {
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: 'Bearer ' + config.token
			},
			method: 'POST',
			mode: 'cors',
			body: JSON.stringify({
				docID: designID,
				variantID,
				includeTags,
				additionalTags: window.zakekeAdditionalTags || [],
				excludeCustomizationPrice,
				uniqueSku: window.zakekeUniqueSku || false,
				qty,
				modificationID: modificationID
			})
		})
			.then((res) => res.json())
			.then((product) => ({
				productID: product.productID,
				variantID: product.variantID,
				handle: product.handle,
				quantity: qty,
				modificationID: modificationID
			}))
			.then(checkProduct);
	}

	function addToCartMultiple(data) {
		var properties = config.properties;
		properties['_bulkCustomization'] = data.designID;

		if (data.previews && data.previews.length > 0) {
			properties['_previews'] = toShopifyPreviews(data.previews);
		}

		if (config.directDownload) {
			properties['_zakekeZip'] = buildDirectDownloadUrl(data.designID);
		}

		if (config.directSummaryDownload) {
			properties['_zakekeSummary'] = buildDirectSummaryDownloadUrl(data.designID);
		}

		if (config.showPrintTypes && data.designInfo) {
			for (const side of designInfo.sides) {
				properties[`_zakekePrintingMethodForSide${side.side.name}`] = side.printType.name;
			}
		}

		if (isCartTransformEnabled()) {
			properties = {
				...properties,
				...getCartTransformProperties(data.designID),
				...getCartTransformPriceProperties(customizationPriceMultiple)
			};
		} else if (config.productAdvancedProcessing || isOptismiticEnabled()) {
			properties.customization = data.designID;

			if (customizationPriceMultiple && getZakekePricingData()) {
				properties['_configurationPrice'] = toShopifyPrice(customizationPriceMultiple);
			}
		}

		const totalQty = data.attributesSelection.reduce((acc, selection) => acc + selection.quantity, 0);

		return Promise.all(
			data.attributesSelection
				.map((selection) => ({
					variantID: matchVariant(selection.attributes).id,
					quantity: selection.quantity
				}))
				.map(function (selection) {
					if ((config.productAdvancedProcessing || isCartTransformEnabled() || isOptismiticEnabled()) && !isInsideShopney()) {
						return Promise.resolve(selection);
					} else {
						return createProduct(data.designID, selection.variantID, window.zakekeIncludeTags, config.priceHide, totalQty);
					}
				})
		)
			.then(function (products) {
				if (isInsideShopney()) {
					return shopneyAddToCartMultiple(
						products.map((product, i) => ({
							product_id: product.productID,
							variant_id: product.variantID,
							quantity: data.attributesSelection[i].quantity
						}))
					);
				}

				if (config.showFileNames && data.fileNames) {
					for (const fileName of data.fileNames) {
						properties[`_zakekeFileForSide${fileName.sideName}`] = fileName.fileName;
					}
				}

				return postprocessProperties(Object.keys(properties).length > 0 ? properties : undefined, {
					design: data.designID,
					product: config.product,
					token: config.token
				}).then((updatedProperties) => {
					const items = products.map((product, i) => ({
						id: product.variantID,
						handle: product.handle,
						quantity: data.attributesSelection[i].quantity,
						properties: updatedProperties
					}));

					if (isCartTransformEnabled()) {
						return cartTransformAddToCart(items);
					} else {
						return ajaxAddToCart(items);
					}
				});
			})
			.then(function () {
				if (!isInsideShopney()) {
					if (window.zakekeAfterAddToCart) {
						window.zakekeAfterAddToCart({
							design: data.designID,
							total_quantity: totalQty,
							product: config.product
						});
					} else {
						window.location.href = getCartUrl();
					}
				}
			});
	}

	function addToCartNameAndNumber(data) {
		let properties = config.properties;

		if (config.productAdvancedProcessing || isOptismiticEnabled()) {
			properties.customization = data.designID;

			if (customizationPriceMultiple && getZakekePricingData()) {
				properties['_configurationPrice'] = toShopifyPrice(customizationPriceMultiple);
			}
		} else if (isCartTransformEnabled()) {
			properties = {
				...properties,
				...getCartTransformProperties(data.designID),
				...getCartTransformPriceProperties(customizationPriceMultiple)
			};
		}

		const totalQty = data.attributes.reduce((acc, selection) => acc + selection.quantity, 0);

		return Promise.all(
			data.attributes
				.map((selection) => ({
					...selection,
					variantID: matchVariant(selection.attributes).id
				}))
				.map((selection) => {
					if (config.productAdvancedProcessing || isOptismiticEnabled() || isCartTransformEnabled()) {
						return Promise.resolve(selection);
					} else {
						return createProduct(
							data.designID,
							selection.variantID,
							window.zakekeIncludeTags,
							config.priceHide,
							totalQty,
							selection.modificationID
						);
					}
				})
		)
			.then((products) => {
				if (config.showFileNames && data.fileNames) {
					for (const fileName of data.fileNames) {
						properties[`_zakekeFileForSide${fileName.sideName}`] = fileName.fileName;
					}
				}

				return postprocessProperties(Object.keys(properties).length > 0 ? properties : undefined, {
					design: data.designID,
					product: config.product,
					token: config.token
				}).then((updatedProperties) => {
					function preProcessNameAndNumberProperties(selection, properties) {
						let updatedProperties = {
							...properties
						};

						if (config.productAdvancedProcessing || isOptismiticEnabled() || isCartTransformEnabled()) {
							updatedProperties._zakekeNameAndNumber = selection.modificationID;
						}

						if (data.previews && data.previews.length > 0) {
							updatedProperties['_previews'] = toShopifyPreviews(data.previews.filter((x) => x.modificationID === selection.modificationID));
						}

						if (config.directDownload) {
							updatedProperties['_zakekeZip'] = buildDirectDownloadUrl(data.designID, selection.modificationID);
						}

						if (config.directSummaryDownload) {
							updatedProperties['_zakekeSummary'] = buildDirectSummaryDownloadUrl(data.designID, selection.modificationID);
						}

						const completeSelection = data.attributes.find((x) => x.modificationID === selection.modificationID);
						if (completeSelection.elementDescs) {
							updatedProperties[window.zakekeNameAndNumberLabel || 'Roster'] = completeSelection.elementDescs.elements
								.map((x) => x.text.content)
								.join('， ');
						}

						if (window.zakekePostProcessNameAndNumberProperties) {
							updatedProperties = window.zakekePostProcessNameAndNumberProperties(updatedProperties);
						}

						return updatedProperties;
					}

					const items = products.map((product, i) => ({
						id: product.variantID,
						handle: product.handle,
						quantity: data.attributes[i].quantity,
						properties: preProcessNameAndNumberProperties(product, updatedProperties || {})
					}));

					if (isCartTransformEnabled()) {
						return cartTransformAddToCart(items);
					} else {
						return ajaxAddToCart(items);
					}
				});
			})
			.then(() => {
				if (window.zakekeAfterAddToCart) {
					window.zakekeAfterAddToCart({
						design: data.designID,
						total_quantity: totalQty,
						product: config.product
					});
				} else {
					window.location.href = getCartUrl();
				}
			});
	}

	function updateCartNameNumber(data) {
		return getCart().then((cart) => {
			const cartItems = cart.items.filter(
				(item) => item.properties && (item.properties['customization'] === data.designID || item.properties['_customization'] === data.designID)
			);

			fetch('/cart/update.json', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					updates: cartItems.reduce((acc, cartItem) => {
						acc[cartItem.key] = 0;
						return acc;
					}, {})
				})
			}).then(() => addToCartNameAndNumber(data));
		});
	}

	function addToCart(designID, variantID, quantity, properties, fileNames, productHandle, designInfo) {
		const form = document.getElementById('zakeke-addtocart');
		localizeAddToCartFormAction(form);

		const formInputId = form.querySelector('input[name="id"]');
		formInputId.value = variantID;

		let formInputQty = form.querySelector('input[name="quantity"]');
		if (!formInputQty) {
			formInputQty = document.createElement('input');
			formInputQty.type = 'hidden';
			formInputQty.name = 'quantity';
			form.appendChild(formInputQty);
		}
		formInputQty.value = quantity;

		const formType = document.createElement('INPUT');
		formType.type = 'hidden';
		formType.name = 'form_type';
		formType.value = 'product';
		form.appendChild(formType);

		if (config.directDownload) {
			properties['_zakekeZip'] = buildDirectDownloadUrl(designID);
		}

		if (config.directSummaryDownload) {
			properties['_zakekeSummary'] = buildDirectSummaryDownloadUrl(designID);
		}

		if (config.showFileNames && fileNames) {
			for (const fileName of fileNames) {
				properties[`_zakekeFileForSide${fileName.sideName}`] = fileName.fileName;
			}
		}

		if (config.showPrintTypes && designInfo) {
			for (const side of designInfo.sides) {
				properties[`_zakekePrintingMethodForSide${side.side.name}`] = side.printType.name;
			}
		}

		postprocessProperties(properties, {
			design: designID,
			product: config.product,
			token: config.token,
		}).then((properties) => {
			if (properties != null) {
				if (config.productAdvancedProcessing && customizationPrice && getZakekePricingData()) {
					properties['_configurationPrice'] = toShopifyPrice(customizationPrice);
				}

				properties = {
					...properties,
					...getCartTransformPriceProperties(customizationPrice)
				};

				Object.keys(properties)
					.map((property) => {
						const input = document.createElement('INPUT');
						input.type = 'hidden';
						input.name = `properties[${property}]`;
						input.value = properties[property];
						return input;
					})
					.forEach((input) => form.appendChild(input));
			}

			if (isCartTransformEnabled()) {
				return fetch(properties['_previews']).then(res => res.blob()).then(previewImg => {
					const body = new FormData(form);
					body.set(`properties[${getPreviewPropertyName()}]`, previewImg, 'Preview.png');
					return fetch(form.action, {
						method: 'POST',
						body: body
					}).then(() => {
						window.location.href = getCartUrl();
					});
				});
			} else if (window.zakekeBeforeAddToCart) {
				window.zakekeBeforeAddToCart(designID, {
					quantity
				})
					.then((_) => form.submit());
			} else {
				if (productHandle) {
					checkProduct({
						handle: productHandle
					}).then(() => {
						form.submit();
					});
				} else {
					form.submit();
				}
			}
		});
	}

	function addToCartContext(color, designID, quantity, previews, fileNames, designInfo) {
		const variantID = matchVariant(JSON.parse(color)).id;

		if (isCartTransformEnabled()) {
			const properties = {
				...getCartTransformProperties(designID),
				_previews: toShopifyPreviews(previews)
			};

			if (window.zakekeAddToCart) {
				window.zakekeAddToCart(designID, variantID, quantity, properties);
			} else {
				addToCart(designID, variantID, quantity, properties, fileNames, null, designInfo);
			}
		} else if (config.productAdvancedProcessing || isOptismiticEnabled()) {
			const properties = {
				customization: designID
			};

			if (previews) {
				properties['_previews'] = toShopifyPreviews(previews);
			}

			if (window.zakekeAddToCart) {
				window.zakekeAddToCart(designID, variantID, quantity, properties);
			} else {
				addToCart(designID, variantID, quantity, properties, fileNames, null, designInfo);
			}
		} else if (isCartTransformEnabled()) {
			const properties = {
				...getCartTransformProperties(designID),
				_previews: toShopifyPreviews(previews)
			};

			if (window.zakekeAddToCart) {
				window.zakekeAddToCart(designID, variantID, quantity, properties);
			} else {
				addToCart(designID, variantID, quantity, properties, fileNames, null, designInfo);
			}
		} else {
			if (previews) {
				additionalCartProperties['_previews'] = toShopifyPreviews(previews);
			}

			if (config.showPrintTypes && designInfo) {
				for (const side of designInfo.sides) {
					additionalCartProperties[`_zakekePrintingMethodForSide${side.side.name}`] = side.printType.name;
				}
			}

			iframe.contentWindow.postMessage(
				{
					data: {
						productID: config.product.id,
						variantID: variantID,
						includeTags: window.zakekeIncludeTags || false,
						additionalTags: window.zakekeAdditionalTags || [],
						excludeCustomizationPrice: config.priceHide || false,
						uniqueSku: window.zakekeUniqueSku || false
					},
					zakekeMessageType: 'AddToCartContext'
				},
				'*'
			);
		}
	}

	function getCartUrl() {
		const shopLocale = getShopLocale();
		const url = '/cart';
		if (shopLocale && shopLocale.root_url !== '/') {
			return shopLocale.root_url + url;
		}

		return url;
	}

	function beforeUpdateCart(design, cartItems) {
		if (window.zakekeBeforeCartUpdate) {
			return window.zakekeBeforeCartUpdate(design, cartItems);
		} else {
			return Promise.resolve(cartItems);
		}
	}

	function updateCart(design, previews, designInfo) {
		return getCart().then((cart) => {
			const price = toShopifyPrice(customizationPrice).toString();
			const cartItems = cart.items.filter(
				(item) =>
					item.properties &&
					(item.properties['customization'] === design || item.properties['_customization'] === design)
			);

			const updatedProperties = {
				_configurationPrice: price,
				_previews: toShopifyPreviews(previews)
			};

			if (config.directDownload) {
				updatedProperties['_zakekeZip'] = buildDirectDownloadUrl(design);
			}

			if (config.directSummaryDownload) {
				updatedProperties['_zakekeSummary'] = buildDirectSummaryDownloadUrl(design);
			}

			if (config.showPrintTypes && designInfo) {
				for (const side of designInfo.sides) {
					updatedProperties[`_zakekePrintingMethodForSide${side.side.name}`] = side.printType.name;
				}
			}

			return Promise.all(
				cartItems.map((item) =>
					postprocessProperties(Object.assign({}, item.properties, updatedProperties), {
						design,
						product: config.product,
						token: config.token
					})
				)
			).then((updatedCartItemsProperties) => {
				const updatedCartItems = updatedCartItemsProperties.map((properties, itemIndex) => {
					const cartItem = {
						id: cartItems[itemIndex].id,
						properties,
						quantity: cartItems[itemIndex].quantity
					};

					if (cartItems[itemIndex].selling_plan_allocation) {
						cartItem.selling_plan = cartItems[itemIndex].selling_plan_allocation.selling_plan.id;
					}

					return cartItem;
				});

				if (window.zakekeRemoveBeforeAddOnUpdate) {
					return cartItems
						.reduce((acc, cartItem) => acc.then(() => ajaxRemoveFromCart(cartItem)), Promise.resolve())
						.then(() => beforeUpdateCart(design, updatedCartItems))
						.then(items => new Promise(resolve => setTimeout(() => resolve(items), 1000)))
						.then(items => {
							if (isCartTransformEnabled()) {
								return cartTransformAddToCart(items);
							} else {
								return formAddToCart(items);
							}
						})
						.then(() => {
							window.location.href = getCartUrl();
						});
				}

				return beforeUpdateCart(design, updatedCartItems)
					.then(items => {
						if (isCartTransformEnabled()) {
							return cartTransformAddToCart(items);
						} else {
							return ajaxAddToCart(items);
						}
					})
					.then(() => cartItems.reduce((acc, cartItem) => acc.then(() => ajaxRemoveFromCart(cartItem)), Promise.resolve()))
					.then(() => {
						window.location.href = getCartUrl();
					});
			});
		});
	}

	function updateZakekeConfig() {
		if (isInsideShopney()) {
			config.productAdvancedProcessing = false;
		} else {
			config.productAdvancedProcessing = config.productAdvancedProcessing ? config.productAdvancedProcessing : window.zakekeProductAdvancedProcessing;
		}

		if (config.productAdvancedProcessing) {
			if (!window.zakekePricingData || !window.zakekePricingData.variantId) {
				config.priceHide = true;
			}
		}

		if (window.zakekePriceHide) {
			config.priceHide = window.zakekePriceHide;
		}
	}

	function getVisitorCode() {
		const id = Math.random().toString(36).substring(7);
		if (window.localStorage) {
			return (localStorage['zakekeGuest'] = localStorage['zakekeGuest'] || id);
		} else {
			if (window.zakekeVisitorCode) {
				return window.zakekeVisitorCode;
			}
			window.zakekeVisitorCode = id;
			return id;
		}
	}

	function getIframeUrl() {
		let iframeRequest = Object.assign({}, config);
		if (window.zakekeCustomerId) {
			iframeRequest.c = window.zakekeCustomerId;
		} else {
			iframeRequest.v = getVisitorCode();
		}

		return fetch(config.zakekeApiUrl + 'shopify/customizer/iframe', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(iframeRequest)
		}).then((res) => res.json());
	}

	function createIframe() {
		const iframe = document.createElement('IFRAME');
		iframe.id = 'zakeke-frame';
		iframe.src = 'about:blank';
		iframe.allow =
			'clipboard-read; clipboard-write; fullscreen; web-share; accelerometer; magnetometer; autoplay; encrypted-media; gyroscope; picture-in-picture; camera *; xr-spatial-tracking;';
		iframe.title = 'Product customization';
		iframe.setAttribute('data-hj-allow-iframe', '');
		return iframe;
	}

	function buildSharedUrl(sharedID) {
		const url = new URL(window.location.href);
		url.searchParams.delete('design');
		url.searchParams.set('shared', sharedID);
		return url.toString();
	}

	var customizationPrice = 0,
		customizationPriceMultiple = 0,
		container = document.getElementById('zakeke-container'),
		iframe = createIframe(),
		additionalCartProperties = {};

	updateZakekeConfig();

	container.appendChild(iframe);

	window.addEventListener(
		'message',
		function (event) {
			if (!iframe) return;

			var iframeUrl = new URL(iframe.src);
			var iframeOrigin = iframeUrl.origin;

			if (event.origin !== iframeOrigin) {
				return;
			}

			if (event.data.zakekeMessageType === 'AddToCart') {
				if (window.zakekeAddToCart) {
					window.zakekeAddToCart(
						event.data.data.handle,
						event.data.data.productID,
						event.data.data.variantID,
						event.data.data.quantity,
						additionalCartProperties
					);
				} else if (isInsideShopney()) {
					shopneyAddToCart(event.data.data.productID, event.data.data.variantID);
				} else {
					addToCart(
						event.data.data.designID,
						event.data.data.variantID,
						event.data.data.quantity,
						additionalCartProperties,
						event.data.data.fileNames,
						event.data.data.handle,
						event.data.data.designInfo
					);
				}
			} else if (event.data.zakekeMessageType === 'AddToCartContext') {
				if (config.design) {
					updateCart(config.design, event.data.data.previews);
				} else {
					if (window.fbq) {
						window.fbq('track', 'AddToCart', {
							content_name: config.product.title,
							content_ids: [config.product.id.toString()],
							content_type: 'product'
						});
					}

					addToCartContext(
						event.data.data.colorID,
						event.data.data.designID,
						event.data.data.quantity,
						event.data.data.previews,
						event.data.data.fileNames,
						event.data.data.designInfo
					);
				}
			} else if (event.data.zakekeMessageType === 'AddToCartMultiple') {
				addToCartMultiple(event.data.data);
			} else if (event.data.zakekeMessageType === 'DesignChange') {
				productData(event.data.design.color, {
					'zakeke-price': event.data.design.price || 0,
					'zakeke-percent-price': event.data.design.percentPrice || 0,
					'zakeke-conditions': event.data.design.conditions || [],
					'zakeke-pricing-model': event.data.design.pricingModel || 'advanced'
				});
			} else if (event.data.zakekeMessageType === 'ProductAttributes') {
				productAttributes(event.data.data);
			} else if (event.data.zakekeMessageType === 'ProductPrice') {
				productPrice(event.data.data);
			} else if (event.data.zakekeMessageType === 'SharedDesign') {
				iframe.contentWindow.postMessage(
					{
						zakekeMessageType: 'SharedDesign',
						data: {
							promiseId: event.data.data.promiseId,
							url: buildSharedUrl(event.data.data.designDocID)
						}
					},
					'*'
				);
			} else if (event.data.zakekeMessageType === 'AddToCartNameAndNumber') {
				if (config.design) {
					updateCartNameNumber(event.data.data);
				} else {
					addToCartNameAndNumber(event.data.data);
				}
			} else if (event.data.zakekeMessageType === 'addToCartBulkAsNN') {
				if (config.design) {
					updateCartNameNumber(event.data.data);
				} else {
					addToCartNameAndNumber(event.data.data);
				}
			}
		},
		false
	);

	function postProcessIframeUrl(iframeUrl) {
		if (window.zakekePostProcessIframeUrl) {
			return window.zakekePostProcessIframeUrl(iframeUrl);
		}

		return iframeUrl;
	}

	function setIframeUrl(iframeUrls) {
		if (config.productAdvancedProcessing || window.zakekeForceClientPreviews || isCartTransformEnabled()) {
			enableClientPreviews(iframeUrls);
		}

		checkStartImage(iframeUrls);

		if (window.zakekeAddToCartText) {
			iframeUrls.customizerLargeUrl = iframeUrls.customizerLargeUrl + '&cartButtonText=' + encodeURIComponent(window.zakekeAddToCartText);
			iframeUrls.customizerSmallUrl = iframeUrls.customizerSmallUrl + '&cartButtonText=' + encodeURIComponent(window.zakekeAddToCartText);
		}

		const zakekeBaseUrl = window.location.href.split('?')[0];
		iframeUrls.customizerLargeUrl = iframeUrls.customizerLargeUrl + '&shareUrlPrefix=' + encodeURIComponent(zakekeBaseUrl);
		iframeUrls.customizerSmallUrl = iframeUrls.customizerSmallUrl + '&shareUrlPrefix=' + encodeURIComponent(zakekeBaseUrl);

		iframe.style.background = 'none';

		if (window.matchMedia('(min-width: 769px)').matches) {
			iframe.src = postProcessIframeUrl(iframeUrls.customizerLargeUrl);
		} else {
			if (window.location.pathname.includes('/a/') || window.location.pathname.includes('/apps/') || window.location.pathname.includes('/tools/') || window.location.pathname.includes('/community/')) {
				document.body.appendChild(container);
			}
			iframe.src = postProcessIframeUrl(iframeUrls.customizerSmallUrl);

			if (navigator.userAgent.match(/instagram/i) && navigator.userAgent.match(/iPhone/i)) {
				const difference = window.screen.height - window.innerHeight;
				iframe.style.paddingBottom = difference + 'px';
			}
		}
	}

	function getShopifyProduct(shopifyProduct) {
		if (window.zakekePostProcessShopifyProduct) {
			return window.zakekePostProcessShopifyProduct(shopifyProduct);
		}

		if (window.zakekeTranslatedProduct && window.zakekeTranslatedProduct.variants) {
			if (window.Shopify && window.Shopify.currency && ['USD', 'EUR', 'GBP', 'CAD'].includes(window.Shopify.currency.active)) {
				shopifyProduct.variants.forEach(variant => {
					const translatedVariant = window.zakekeTranslatedProduct.variants.find(x => x.id === variant.id);
					if (translatedVariant) {
						variant.price = fromShopifyPrice(translatedVariant.price);
					}
				});
			}
			shopifyProduct.title = window.zakekeTranslatedProduct.title;
		}

		return Promise.resolve(shopifyProduct);
	}

	getIframeUrl().then((res) => {
		config.token = res.token;
		config.variantId = res.variantId;

		return getShopifyProduct(res.product).then((product) => {
			config.product = product;
			setIframeUrl(res);
		});
	});
}
