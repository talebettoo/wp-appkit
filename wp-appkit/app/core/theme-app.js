/**
 * Defines functions that can be called from theme functions.js.
 * (Those functions can't be directly called form theme templates).
 */
define( function( require, exports ) {

	"use strict";

	var _ = require( 'underscore' ),
			Backbone = require( 'backbone' ),
			RegionManager = require( 'core/region-manager' ),
			Utils = require( 'core/app-utils' ),
			Config = require( 'root/config' ),
			Messages = require( 'core/messages' ),
			App = require( 'core/app' ),
			Hooks = require( 'core/lib/hooks' ),
			TemplateTags = require( 'core/theme-tpl-tags' ),
			PhoneGap = require( 'core/phonegap/utils' );

	var themeApp = { };

	/************************************************
	 * Events management
	 */

	/**
	 * Theme event aggregator
	 */
	var vent = _.extend( { }, Backbone.Events );

	/**
	 * Allows themes (and addons) to trigger events
	 * @param string event Event id
	 * @param JSON object data
	 */
	themeApp.trigger = function( event, data ) {
		vent.trigger( event, data );
	};

	/**
	 * Aggregate App and RegionManager events
	 */
	themeApp.on = function( event, callback ) {
		if ( _.contains( [ 'screen:leave',
							'screen:showed',
							'screen:before-transition',
							'menu:refresh',
							'header:render',
							'waiting:start',
							'waiting:stop'
						],
						event ) ) {
			//Proxy RegionManager events :
			RegionManager.on( event, callback );
		} else {
			vent.on( event, callback );
		}
	};

	/**
	 * Proxy App events to theme events
	 *
	 * @param {string} event App event id
	 * @param {object} data App event data
	 * @returns {event} Triggers theme event based on App core event
	 */
	App.on( 'all', function( event, data ) {

		var theme_event_data = format_theme_event_data( event, data );

		/**
		 * "stop-theme-event" filter : use this filter to avoid an event from triggering in the theme.
		 * Useful to deactivate some error events display for exemple.
		 * 
		 * @param {boolean} Whether to stop the event or not. Default false.
		 * @param {JSON Object} theme_event_data : Theme event data object
		 * @param {String} event : Original (internal) event name
		 */
		var stop_theme_event = Hooks.applyFilters( 'stop-theme-event', false, [theme_event_data, event] );
		
		if ( !stop_theme_event ) {
			
			if ( theme_event_data.type == 'error'
				 || theme_event_data.type == 'info'
				 || theme_event_data.type == 'network'
				) {
				//2 ways of binding to error and info events :
				vent.trigger( event, theme_event_data ); //Ex: bind directly to 'info:no-content'
				vent.trigger( theme_event_data.type, theme_event_data ); //Ex: bind to general 'info', then filter with if( info.event == 'no-content' )
			}
			
		}

	} );

	/**
	 * Formats App core events feedbacks in a themes friendly way.
	 *
	 * @param {string} event App event id (example "error:synchro:ajax")
	 * @param {object} data
	 * @returns {object} {
	 *		event: string : theme event id (example : "synchro:ajax"),
	 *		type: string : 'error' | 'info',
	 *		message: string : error or info message
	 *		data: object : original core event data : {
	 *			type: string : 'ajax' | 'ws-data' | 'not-found' | 'wrong-data',
	 *			where: string : core function where the event occured
	 *			message: string : message associated to the event
	 *			data: object : data associated to the core event
	 *		}
	 * }
	 */
	var format_theme_event_data = function( event, data ) {
		
		var theme_event_data = { 
			event: event, 
			type: '',
			subtype: data !== undefined && data.hasOwnProperty( 'type' ) ? data.type : '',
			message: '', 
			core_data: data 
		};

		if ( event.indexOf( 'error:' ) === 0 ) {

			theme_event_data.type = 'error';
			theme_event_data.event = event.replace( 'error:', '' );

			if ( data.type == 'ajax' ) {
				theme_event_data.message = Messages.get('error_remote_connexion_failed');
			}
			else {
				theme_event_data.message = Messages.get('error_occured_undefined');
			}

		} else if ( event.indexOf( 'info:' ) === 0 ) {

			theme_event_data.type = 'info';
			theme_event_data.event = event.replace( 'info:', '' );

			if ( event == 'info:no-content' ) {
				theme_event_data.message = Messages.get('info_no_content');
			}

		} else if ( event.indexOf( 'network:' ) === 0 ) {

			theme_event_data.type = 'network';
			theme_event_data.event = event.replace( 'network:', '' );

			if( event == 'network:online' ) {
				theme_event_data.message = Messages.get('info_network_online');
			}else if( event == 'network:offline' ) {
				theme_event_data.message = Messages.get('info_network_offline');
			}

		}
		
		/**
		 * "theme-event-message" filter : use this hook to customize event messages
		 * 
		 * @param {String} Event message to customize
		 * @param {JSON Object} theme_event_data : Theme event data object
		 * @param {String} event : Original (internal) event name
		 */
		theme_event_data.message = Hooks.applyFilters( 'theme-event-message', theme_event_data.message, [theme_event_data, event] );
		
		return theme_event_data;
	};

	/************************************************
	 * Themes actions results
	 */

	/**
	 * Formats data that is used in themes as the result of an event or
	 * treatment.
	 *
	 * @param {boolean} ok
	 * @param {string} message
	 * @param {object} data
	 * @returns object {
	 *		ok: boolean,
	 *		message: string,
	 *		data: object
	 * }
	 */
	var format_result_data = function( ok, message, data ) {

		ok = ok === true || ok === 1 || ok === '1';

		message = !_.isUndefined(message) && _.isString(message) ? message: '';

		data = !_.isUndefined(data) ? data : {};

		return { ok: ok, message: message, data: data };
	};


	/************************************************
	 * Filters, actions and Params management
	 */
	themeApp.filter = function( filter, callback, priority ) {
		Hooks.addFilter( filter, callback, priority );
	}

	themeApp.action = function( action, callback, priority ) {
		Hooks.addAction( action, callback, priority );
	}

	themeApp.setParam = function( param, value ) {
		App.setParam( param, value );
	};


	/************************************************
	 * App contents refresh
	 */

	var refreshing = 0;

	/**
	 * Launches app content refresh
	 *
	 * @param {callback} cb_ok Treatment to apply on success
	 * @param {callback} cb_error Treatment to apply on error
	 * @returns {event|callback} : when refresh is finished :
	 * - "refresh:end" event is triggered with a "result" object param
	 * - callback cb_ok is called if success, with a "result" object param
	 * - callback cb_error is called if error, with a "result" object param
	 *
	 * "result" object : {
	 *		ok: boolean : true if refresh is successful,
	 *		message: string : empty if success, error message if refresh fails,
	 *		data: object : empty if success, error object if refresh fails :
	 *			  Use this result.data if you need specific info about the error.
	 *			  See format_theme_event_data() for error object details.
	 * }
	 */
	themeApp.refresh = function( cb_ok, cb_error ) {

		refreshing++;
		vent.trigger( 'refresh:start' );

		App.sync(
			function() {
				RegionManager.buildMenu(
					function() {
						App.resetDefaultRoute();

						/**
						 * Use the 'go-to-default-route-after-refresh' to control whether
						 * the default route should be automatically triggered after refresh.
						 */
						var go_to_default_route = App.getParam('go-to-default-route-after-refresh');

						if( go_to_default_route ){
							App.router.default_route();
						}

						Backbone.history.stop();
						Backbone.history.start({silent:false});

						refreshing--;
						vent.trigger( 'refresh:end', format_result_data(true) );

						if ( cb_ok ) {
							cb_ok();
						}
					},
					true
				);
			},
			function( error ) {
				refreshing--;

				var formated_error = format_theme_event_data( error.event, error );

				if ( cb_error ) {
					cb_error( formated_error );
				}

				var result = format_result_data(false,formated_error.message,formated_error);

				vent.trigger( 'refresh:end', result );
			},
			true
		);
	};

	themeApp.isRefreshing = function() {
		return refreshing > 0;
	};

	/************************************************
	 * App navigation
	 */

	themeApp.navigate = function( navigate_to_fragment ) {
		App.router.navigate( navigate_to_fragment, { trigger: true } );
	};

	themeApp.navigateToDefaultRoute = function() {
		App.router.default_route();
	};

	/**
	 * Reload current screen : re-trigger current route.
	 */
	themeApp.reloadCurrentScreen = function() {
		//Directly navigate to current fragment doesn't work (Backbone sees that
		//it is the same and doesn't re-trigger it!) : we have to navigate to a
		//false dummy route (without triggering the navigation, so it is invisible)
		//and then renavigate to original current route :
		var current_fragment = Backbone.history.getFragment();
		App.router.navigate( 'WpakDummyRoute' ); //Route that does not exist
		App.router.navigate( current_fragment, { trigger: true } );
	};

	/**
	 * Re-render current view WITHOUT re-triggering any route.
	 */
	themeApp.rerenderCurrentScreen = function() {
		var current_view = RegionManager.getCurrentView();
		current_view.render();
	};

	/************************************************
	 * Back button
	 */

	/**
	 * Automatically shows and hide Back button according to current screen (list, single, page, comments, etc...)
	 * Use only if back button is not refreshed at each screen load! (otherwhise $go_back_btn will not be set correctly).
	 * @param $go_back_btn Back button jQuery DOM element
	 */
	themeApp.setAutoBackButton = function( $go_back_btn, do_before_auto_action ) {
		RegionManager.on( 'screen:showed', function( current_screen, view ) {
			var display = themeApp.getBackButtonDisplay();
			if ( display == 'show' ) {
				if ( do_before_auto_action != undefined ) {
					do_before_auto_action( true );
				}
				$go_back_btn.show();
				themeApp.updateBackButtonEvents( $go_back_btn );
			} else if ( display == 'hide' ) {
				if ( do_before_auto_action != undefined ) {
					do_before_auto_action( false );
				}
				themeApp.updateBackButtonEvents( $go_back_btn );
				$go_back_btn.hide();
			}
		} );
	};

	/**
	 * To know if the back button can be displayed on the current screen,
	 * according to app history. Use this to configure back button
	 * manually if you don't use themeApp.setAutoBackButton().
	 */
	themeApp.getBackButtonDisplay = function() {
		var display = '';

		var previous_screen = App.getPreviousScreenData();

		if ( !_.isEmpty( previous_screen ) ) {
			display = 'show';
		} else {
			display = 'hide';
		}

		return display;
	};

	/**
	 * Sets back buton click event. Use this to configure back button
	 * manually if you don't use themeApp.setAutoBackButton().
	 * @param $go_back_btn Back button jQuery DOM element
	 */
	themeApp.updateBackButtonEvents = function( $go_back_btn ) {
		if ( $go_back_btn.length ) {
			var display = themeApp.getBackButtonDisplay();
			if ( display == 'show' ) {
				$go_back_btn.unbind( 'click' ).click( function( e ) {
					e.preventDefault();
					var prev_screen_link = App.getPreviousScreenLink();
					themeApp.navigate( prev_screen_link );
				} );
			} else if ( display == 'hide' ) {
				$go_back_btn.unbind( 'click' );
			}
		}
	};

	/************************************************
	 * "Get more" link
	 */

	themeApp.getGetMoreLinkDisplay = function() {
		var get_more_link_data = { display: false, nb_left: 0 };

		var current_screen = App.getCurrentScreenData();

		if ( current_screen.screen_type == 'list' ) {
			var component = App.components.get( current_screen.component_id );
			if ( component ) {
				var component_data = component.get( 'data' );
				if ( component_data.hasOwnProperty( 'ids' ) ) {
					var nb_left = component_data.total - component_data.ids.length;
					get_more_link_data.nb_left = nb_left;
					get_more_link_data.display = nb_left > 0;
				}
			}
		}

		get_more_link_data = Hooks.applyFilters( 'get-more-link-display', get_more_link_data, [ current_screen ] );

		return get_more_link_data;
	};

	themeApp.getMoreComponentItems = function( cb_after, cb_error ) {
		var current_screen = App.getCurrentScreenData();
		if ( current_screen.screen_type === 'list' ) {
			App.getMoreOfComponent(
					current_screen.component_id,
					function( new_items, is_last, data ) {
						var current_archive_view = RegionManager.getCurrentView();
						current_archive_view.addPosts( new_items );
						current_archive_view.render();
						cb_after( is_last, new_items, data.nb_left );
					},
					function( error ) {
						var get_more_link_data = themeApp.getGetMoreLinkDisplay();
						cb_error( format_theme_event_data( error.event, error ), get_more_link_data );
					}
			);
		} else {
			Hooks.doActions( 'get-more-component-items', [ current_screen, cb_after, cb_error ] );
		}
	};
	
	/************************************************
	 * Comments
	 */
	
	/**
	 * Displays the comments screen for a given post.
	 * Retrieves the post comments from server or from memory if already cached,
	 * then navigate to #comments-[post_id].
	 * Using this function allows to use success and error callbacks (cb_ok/cb_error),
	 * which you can't do if you navigate directly to #comments-[post_id] in your theme.
	 * 
	 * Note that the cb_ok() callback is called after comments are retrieved, but can't 
	 * be called after the comments view is rendered (as view rendering is done in router).
	 * If you need to do something after the comments screen is showed, you can use
	 * the 'screen:showed' event where you'll test if ( current_screen.screen_type === 'comments' ) ).
	 * 
	 * @param {int} post_id         Post we want to retrieve the comments for.
	 * @param {function} cb_ok      What to do if coments are retrieved ok
	 * @param {function} cb_error   What to do if an error occurs while retrieving comments
	 */
	themeApp.displayPostComments = function ( post_id, cb_ok, cb_error ) {

		App.getPostComments(
			post_id,
			function ( comments, post, item_global ) {
				cb_ok( comments.toJSON(), post.toJSON(), item_global );
				themeApp.navigate( '#comments-'+ post_id );
			},
			function ( error ) {
				cb_error( format_theme_event_data( error.event, error ) );
			}
		);

	};
	
	/************************************************
	 * Components
	 */
	
	/**
	 * Retrieve all app's components
	 * 
	 * @returns {Array} Array of compoents as JSON objects
	 */
	themeApp.getComponents = function() {
		return App.getComponents();
	};

	/************************************************
	 * "Live Query" Web Service
	 */

	/**
	 * Call live query web service
	 *
	 * @param JSON Object web_service_params Any params that you want to send to the server.
	 *        The following params are automatically recognised and interpreted on server side :
	 *        - wpak_component_slug : { string | Array of string } components to make query on
	 *        - wpak_query_action : { string } 'get-component' to retrieve the full component, or 'get-items' to retrieve choosen component items
	 *        - wpak_items_ids : { int | array of int } If wpak_query_action = 'get-items' : component items ids to retrieve
	 * @param options JSON Object : allowed settings :
	 * - success Function Callback called on success
	 * - error Function Callback called on error
	 * - auto_interpret_result Boolean (default true). If false, web service answer must be interpreted in the cb_ok callback.
	 * - type String : can be one of :
	 *       -- "update" : merge new with existing component data,
	 *       -- "replace" : delete current component data and replace with new
	 *       -- "replace-keep-global-items" (default) : for list components : replace component ids and merge global items
	 * - persistent Boolean (default false). If true, new data is stored in local storage.
	 */
	themeApp.liveQuery = function( web_service_params, options ){

		var cb_ok = null;
		if( options.success ) {
			cb_ok = options.success;
			delete options.success;
		}

		var cb_error = null;
		if( options.error ) {
			cb_error = options.error;
			delete options.error;
		}

		App.liveQuery( web_service_params, cb_ok, cb_error, options );

	};

	/**
	 * Refresh component items from server.
	 *
	 * @param {int} component_id
	 * @param {int | array of int} items_ids. If none provided, will refresh all component items.
	 * @param {JSON Object} options :
	 *	- success {callback}
	 *	- error {callback}
	 *	- autoformat_answer {boolean} If true (default), the answer returned to the success
	 *	  callback is automatically formated to return significant data. If false, the full
	 *	  liveQuery answer is returned no matter what.
	 */
	themeApp.refreshComponentItems = function ( component_id, items_ids, options ) {
		var existing_component = App.components.get( component_id );
    	if( existing_component ) {

			//If no item id provided, refresh all component items :
			if ( items_ids === undefined || items_ids === '' || items_ids === 0 || ( _.isArray( items_ids ) && items_ids.length === 0 ) ) {
				var component_data = existing_component.get('data');
				if ( component_data && component_data.ids ) {
					items_ids = component_data.ids;
				} else {
					items_ids = null;
				}
			}

			if ( items_ids !== null ) {

				themeApp.liveQuery(
					{
						wpak_component_slug : component_id,
						wpak_query_action : 'get-items',
						wpak_items_ids : items_ids
					},
					{	//Those are default liveQuery options values, but we set
						//them explicitly for more clarity :
						type : 'update',
						auto_interpret_result : true,
						persistent : false,

						//Callbacks :
						success : function ( answer ) {
							if ( options !== undefined && options.success ) {
								//If no globals in answer, return full answer
								var refreshed_items = answer;

								if ( !options.hasOwnProperty( 'autoformat_answer' ) || options.autoformat_answer === true ) {
									if ( answer.globals ) {
										//If globals in answer, return items indexed on globals :
										refreshed_items = answer.globals;
										var globals = [];
										_.each( answer.globals, function ( items, global ) {
											globals.push( global );
										} );
										if ( globals.length === 1 ) {
											//If only one global returned, return directly the corresponding items
											if ( _.isArray( items_ids ) ) {
												refreshed_items = answer.globals[globals[0]];
											} else {
												//If only one item asked, return only this item :
												refreshed_items = _.first( _.toArray( answer.globals[globals[0]] ) );
											}
										}
									}
								}

								options.success( refreshed_items );
							}
						},
						error : function ( answer_error ) {
							if ( options !== undefined && options.error ) {
								options.error( answer_error );
							}
						}
					}
				);

			}
		}
	};

	/************************************************
	 * DOM element auto class
	 */

	/**
	 * Sets class to the given DOM element according to the given current screen.
	 * If element is not provided, defaults to <body>.
	 */
	var setContextClass = function( current_screen, element_id ) {
		if ( !_.isEmpty( current_screen ) ) {
			var $element = element_id == undefined ? $( 'body' ) : $( '#' + element_id );
			$element.removeClass( function( index, css ) {
				return ( css.match( /\app-\S+/g ) || [ ] ).join( ' ' );
			} );
			$element.addClass( 'app-' + current_screen.screen_type );
			$element.addClass( 'app-' + current_screen.fragment );
		}
	};

	/**
	 * Adds class on given DOM element according to the current screen.
	 * If element is not provided, defaults to <body>.
	 * @param activate Set to true to activate
	 */
	themeApp.setAutoContextClass = function( activate, element_id ) {
		if ( activate ) {
			RegionManager.on( 'screen:showed', function( current_screen ) {
				setContextClass( current_screen, element_id );
			} );
			setContextClass( App.getCurrentScreenData(), element_id );
		}
		//TODO : handle deactivation!
	};


	/************************************************
	 * Screen transitions
	 */

	/**
	 * Returns the transition direction ("next-screen", "previous-screen", "default" or customized) according
	 * to current and previous screen.
	 * 
	 * @param {Object} current_screen : The screen that is (going to be) displayed after transition
	 * @param {Object} previous_screen : The screen we're leaving.
	 * @returns {String} Transition direction (default 'default', 'next-screen' and 'previous-screen' but 
	 * can be customized with the "transition-direction" filter).
	 */
	themeApp.getTransitionDirection = function( current_screen, previous_screen ) {
		var transition = 'default';

		if ( current_screen.screen_type == 'list' || current_screen.screen_type == 'custom-component' ) {
			if ( previous_screen.screen_type == 'single' ) {
				transition = 'previous-screen';
			} else {
				transition = 'default';
			}
		} else if ( current_screen.screen_type == 'single' ) {
			if ( previous_screen.screen_type == 'list' || previous_screen.screen_type == 'custom-component' ) {
				transition = 'next-screen';
			} else if ( previous_screen.screen_type == 'comments' ) {
				transition = 'previous-screen';
			} else {
				transition = 'default';
			}
		} else if ( current_screen.screen_type == 'comments' ) {
			transition = 'next-screen';
		} else {
			transition = 'default';
		}
		
		/**
		 * "transition-direction" filter : use this filter to customize transitions
		 * directions according to what are current (ie asked) and previous screen.
		 * 
		 * @param {string} Transition direction to override if needed.
		 * @param {Object} current_screen : The screen that is (going to be) displayed after transition.
		 * @param {Object} previous_screen : The screen we're leaving.
		 */
		var transition = Hooks.applyFilters( 'transition-direction', transition, [current_screen, previous_screen] );

		return transition;
	};

	/**
	 * This allows to define your own previous-screen/next-screen/default transitions between screens.
	 * If you need more transition types than just previous/next/default (like single-to-comment, comment-to-single etc),
	 * do the following (in functions.js) : 
	 * - App.setParam( 'custom-screen-rendering', true );
	 * - use the 'screen-transition' action hook to define your own transitions.
	 * 
	 * @param {callback} transition_default
	 * @param {callback} transition_previous_screen
	 * @param {callback} transition_next_screen
	 */
	themeApp.setAutoScreenTransitions = function( transition_default, transition_previous_screen, transition_next_screen ) {

		//Set custom-screen-rendering param to true so that screen rendering
		//uses the 'screen-transition' action to render :
		themeApp.setParam( 'custom-screen-rendering', true );

		themeApp.action( 'screen-transition', function( $wrapper, $current, $next, current_screen, previous_screen, $deferred ) {

			var direction = themeApp.getTransitionDirection( current_screen, previous_screen );

			switch ( direction ) {
				case 'previous-screen':
					transition_previous_screen( $wrapper, $current, $next, $deferred );
					break;
				case 'next-screen':
					transition_next_screen( $wrapper, $current, $next, $deferred );
					break;
				case 'default':
					transition_default( $wrapper, $current, $next, $deferred );
					break;
				default:
					transition_default( $wrapper, $current, $next, $deferred );
					break;
			}
			;

		} );

	};

	/************************************************
	 * App network management
	 */

	/**
	 * Retrieve network state : "online", "offline" or "unknown"
	 * If full_info is passed and set to true, detailed connexion info is
	 * returned (Wifi, 3G etc...).
	 *
	 * @param boolean full_info Set to true to get detailed connexion info
	 * @returns string "online", "offline" or "unknown"
	 */
	themeApp.getNetworkState = function(full_info) {
		return PhoneGap.getNetworkState(full_info);
	};

	/************************************************
	 * App custom pages and custom routes management
	 */

	themeApp.showCustomPage = function( template, data, id ) {
		if ( template === undefined ) {
			template = 'custom';
		}
		if ( data === undefined ) {
			data = {};
		}
		if ( id === undefined ) {
			id = 'auto-custom-page';
		}
		App.showCustomPage( template, data, id );
	};

	themeApp.addCustomRoute = function( fragment, template, data ) {
		fragment = fragment.replace('#','');
		if ( template === undefined ) {
			template = 'custom';
		}
		if ( data === undefined ) {
			data = {};
		}
		App.addCustomRoute( fragment, template, data );
	};

	themeApp.removeCustomRoute = function( fragment ) {
		fragment = fragment.replace('#','');
		App.removeCustomRoute( fragment );
	};

	/**************************************************
	 * Retrieve internal app data that can be useful in themes
	 */

	/**
	 * Retrieves a list of items (posts for example) from local storage
	 *  
	 * @param {array} items_ids IDs of the items to retrieve
	 * @param {string} global_key (Optional) global to retrieve the items from: 'posts' (default) or 'pages'.
	 * @param {string} result_type 'slice' to retrieve a Backbone Collection (default), 'array' to retrieve an array.
	 * @returns {Backbone Collection | Array | null} items list
	 */
	themeApp.getItems = function( items_ids, global_key, result_type ) {
		var items = null;

		global_key = global_key || 'posts';
		result_type = result_type || 'slice';

		switch( result_type ) {
			case 'slice' :
				items = App.getGlobalItemsSlice( global_key, items_ids );
				break;
			case 'array' :
				items = App.getGlobalItems( global_key, items_ids );
				break;
		}

		return items;
	};
	
	/**
	 * Retrieves an item (post for example) from local storage
	 * 
	 * @param {int} item_id Post ID of the post to retrieve
	 * @param {string} global_key (Optional) global to retrieve the item from: 'posts' (default) or 'pages'.
	 * @returns {JSON Object} item (post or page) object
	 */
	themeApp.getItem = function( item_id, global_key ) {
		
		global_key = global_key || 'posts';
		
		return App.getGlobalItem( global_key, item_id );
	};
	
	/**
     * Retrieves current screen infos
	 * 
	 * (Alias of theme-tpl-tags::getCurrentScreen(): because getting current
	 * screen is needed very often, we need it both sides)
	 * 
     * @return JSON object containing :
     * - screen_type : list, single, comments, page
     * - fragment : unique screen url id (what's after # in url)
     * - component_id : component slug id, if displaying a component screen (list, page)
     * - item_id : current item id, if displaying single content (post,page)
	 * - label : current item label (title of component, title of post)
     * - data : contains more specific data depending on which screen type is displayed
     * 	> total : total number of posts for lists
     * 	> query : query vars used to retrieve contents (taxonomy, terms...)
     * 	> ids : id of posts displayed in lists
     * 	> any other specific data depending on currently displayed component
     */
    themeApp.getCurrentScreen = function() {
        return App.getCurrentScreenData();
    };
	
	/**
	 * Retrieves useful data corresponding to the object that is currently displayed.
	 * The returned set of data is a custom selection of data that can be found in 
	 * "Screen data" (ThemeApp.getCurrentScreen()) and "View data" (RegionManager.getCurrentView()).
	 * 
	 * @returns JSON Object depending on current screen:
	 * - for lists:             object containing: title (list title), posts (list of posts), ids (=post ids), total, component_id, query
	 * - for single:            post object: id, post_type, date, title, content, excerpt, thumbnail, author, nb_comments, slug, permalink
	 * - for comments:          object containing: post (post we retrieve the comments for) and comments (list of comments for this post)
	 * - for pages:             page object: id, post_type, date, title, content, excerpt, thumbnail, author, nb_comments, slug, permalink, tree_data
	 * - for custom pages:      object containing: id, route, title (if custom page data contains a 'title' property), data (custom page data), template.
	 * - for custom components: object containing: component_id, title, route, data, template
	 * - for all:               field 'screen_type': can be: 'list', 'single', 'comments', 'page', 'custom-page', 'custom-component'
	 */
	themeApp.getCurrentScreenObject = function() {
		var screen_object = {};
		
		var screen_data = App.getCurrentScreenData();
		var current_view = RegionManager.getCurrentView();
		
		switch( screen_data.screen_type ) {
			case 'list':
				//For lists, build a custom screen object from screen data and current view data:
				screen_object = {
					title: screen_data.label,
					component_id: screen_data.component_id,
					posts: current_view.posts.toJSON()
				};
				_.extend( screen_object, screen_data.data ); //Adds ids, query, total
				break;
			case 'single':
				//For single, just return the current post object:
				if ( screen_data.data.post ) {
					screen_object = screen_data.data.post;
				} else if ( screen_data.data.item ) {
					screen_object = screen_data.data.item;
				}
				break;
			case 'comments':
				//For comments, build a custom screen object from screen data and current view data:
				screen_object = {
					post: current_view.post.toJSON(),
					comments: current_view.comments.toJSON()
				};
				break;
			case 'page':
				//For page, just return the current page object:
				screen_object = screen_data.data.item;
				break;
			case 'custom-page':
				//For custom pages, return page id, page route, page custom data, and page template:
				//(id and route are the same thing, because a custom page is identified by its route)
				screen_object = {
					id: screen_data.item_id,
					route: screen_data.item_id,
					title: current_view.custom_page_data.hasOwnProperty( 'title' ) ? current_view.custom_page_data.title : '',
					data: current_view.custom_page_data,
					template: current_view.template_name
				};
				break;
			case 'custom-component':
				//For custom components, return component_id, title, route, data, template:
				screen_object = {
					component_id: screen_data.component_id,
					title: screen_data.label,
					route: screen_data.fragment,
					data: screen_data.data,
					template: current_view.template_name
				};
				break;
		};
		
		screen_object.screen_type = screen_data.screen_type;
		
        return screen_object;
    };

	//Use exports so that theme-tpl-tags and theme-app (which depend on each other, creating
	//a circular dependency for requirejs) can both be required at the same time
	//(in theme functions.js for example) :
	_.extend( exports, themeApp );
} );