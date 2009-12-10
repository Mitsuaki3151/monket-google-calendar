window.GoogleEventLoader = function(service, loading) {
	var me = this;
	
	me.service = service;
	me.cache = {};
	me.loading = loading;
	
	me.init = function(successCallback, failureCallback) {
		me.loading.show();
	    me.service.getAllCalendarsFeed('http://www.google.com/calendar/feeds/default/allcalendars/full',
	    function(result) {
			me.loading.hide();
	        me.calendars = result.feed.entry;
			successCallback();
	    },
	    function failureCallback() {
	    	me.loading.hide();
			failureCallback();
	    });		
		
		// if (localStorage && localStorage.offlineCache) {
		// 	me.offlineCache = JSON.parse(localStorage.offlineCache, function (key, value) {
		//                 var a;
		//                 if (typeof value === 'string') {
		//                     a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
		//                     if (a) {
		//                         return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
		//                     }
		//                 }
		//                 return value;
		//             });			
		// }
	};
	
	me.load = function(startDate, endDate, successCallback, failureCallback) {
		// if (me.offlineCache && me.datesInOfflineCache(startDate, endDate)) {
		// 	successCallback(me.getOfflineCachedEvents(startDate, endDate), startDate, endDate);
		// }
		
		if (me.datesInCache(startDate, endDate)) {
			successCallback(me.getCachedEvents(startDate, endDate), startDate, endDate);
		} else if (me.isLoading(startDate, endDate)) {
			me.addCallbacks(startDate, endDate, successCallback, failureCallback);
		} else {
			var cacheStartDate = new Date(startDate.getFullYear(), 0, 1);
			var cacheEndDate = new Date(startDate.getFullYear()  +1, 0, 7);

			me.cache[me.getCacheKey(startDate)] = {
				remaining: me.calendars.length,
				entries: [],
				callbacks: []
			};

			me.loading.show();

			me.addCallbacks(startDate, endDate, successCallback, failureCallback);

			for (var i = 0; i < me.calendars.length; i++) {
				me.loadFromGoogle(cacheStartDate, cacheEndDate, function(entries) {
					var cacheInfo = me.cache[me.getCacheKey(startDate)];
					cacheInfo.remaining--;
					cacheInfo.entries = cacheInfo.entries.concat(entries);

					me.fireCallbacks(cacheInfo, true);
					if (cacheInfo.remaining == 0) {
						me.clearCallbacks(cacheInfo);
						me.loading.hide();
						
						// if (localStorage) {
						// 	localStorage.offlineCache = JSON.stringify(me.cache);
						// }
					}
				}, function() {
					var cacheInfo = me.cache[me.getCacheKey(startDate)];
					cacheInfo.remaining--;

					me.fireCallbacks(cacheInfo, false);
					if (cacheInfo.remaining == 0) {
						me.clearCallbacks(cacheInfo);
						me.loading.hide();
					}
				}, i);
			}
			
		}
	};
	
	me.getCacheKey = function(startDate) {
		return startDate.getFullYear();
	};
	
	me.isLoading = function(startDate, endDate) {
		var cacheInfo = me.cache[me.getCacheKey(startDate)];
		return !!cacheInfo;
	};
	
	me.datesInCache = function(startDate, endDate) {
		var cacheInfo = me.cache[me.getCacheKey(startDate)];
		return (cacheInfo && cacheInfo.remaining == 0);
	};
	
	me.addCallbacks = function(startDate, endDate, successCallback, failureCallback) {
		var cacheInfo = me.cache[me.getCacheKey(startDate)];
		cacheInfo.callbacks.push({
			success: successCallback,
			failure: failureCallback,
			startDate: startDate,
			endDate: endDate
		});
	};
	
	me.fireCallbacks = function(cacheInfo, success) {
		$.each(cacheInfo.callbacks, function() {
			if (success) {
				var entries = me.getCachedEvents(this.startDate, this.endDate);
				this.success(entries, this.startDate, this.endDate);
			} else {
				this.failure(this.startDate, this.endDate);
			}
		});
	};
	
	me.clearCallbacks = function(cacheInfo) {
		cacheInfo.callbacks = [];
	};
	
	me.getCachedEvents = function(startDate, endDate) {
		var cacheInfo = me.cache[me.getCacheKey(startDate)];
		var cacheEntries = cacheInfo.entries;
		
		var entries = [];
		for (var i = 0; i < cacheEntries.length; i++) {
			var entry = cacheEntries[i];
			
			if (entry.end > startDate && entry.start <= endDate) {
				entries.push(entry);
			}
		}
				
		return entries;
	};
	
	// me.datesInOfflineCache = function(startDate, endDate) {
	// 	var cacheInfo = me.offlineCache[me.getCacheKey(startDate)];
	// 	return (cacheInfo && cacheInfo.remaining == 0);
	// };
	// 
	// me.getOfflineCachedEvents = function(startDate, endDate) {
	// 	var cacheInfo = me.offlineCache[me.getCacheKey(startDate)];
	// 	var cacheEntries = cacheInfo.entries;
	// 
	// 	var entries = [];
	// 	for (var i = 0; i < cacheEntries.length; i++) {
	// 		var entry = cacheEntries[i];
	// 
	// 		if (entry.end > startDate && entry.start <= endDate) {
	// 			entries.push(entry);
	// 		}
	// 	}
	// 			
	// 	return entries;
	// }
	
	me.loadFromGoogle = function(startDate, endDate, successCallback, failureCallback, calNumber) {
		
		var eventsCallback = function(result) {
		    var entries = result.feed.entry;

			var results = [];

		    for (var i = 0; i < entries.length; i++) {
		        var entry = entries[i];

				var entrystartDate, entryendDate, length;
				var times = entry.getTimes();
			    if (times.length > 0) {
			      	var startTime = times[0].getStartTime().getDate();
					entrystartDate = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());

			      	var endTime = times[0].getEndTime().getDate();
					var endDate = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate());

					// Get the whole number of days difference
					// And then add on any extra hours in the last day
					// Done like this to avoid issues when summar time changes
					length = Math.round((endDate - entrystartDate) / (1000 * 60 * 60 * 24));
					if ((endTime - endDate) > 0) {
						length++;
					}

					entryendDate = entrystartDate.addDays(length);
				}


				var event = {};
				event.summary = $.trim(entry.getTitle().getText());
				event.calNumber = calNumber + 1;
				event.start = entrystartDate;
				event.end = entryendDate;
				event.length = length;

				if (entryendDate > startDate) {
					results.push(event);
				}
								
		    }

			successCallback(results, startDate, endDate);
		};
		
		var calendar = me.calendars[calNumber];
		var uri = calendar.getLink().href;

        var query = new google.gdata.calendar.CalendarEventQuery(uri);

        var startMin = new google.gdata.DateTime(startDate);
        var startMax = new google.gdata.DateTime(endDate);
        query.setMinimumStartTime(startMin);
        query.setMaximumStartTime(startMax);
        query.setSingleEvents(true);
        query.setMaxResults(500);
        query.setOrderBy('starttime');
        query.setSortOrder('a');

        me.service.getEventsFeed(query, eventsCallback, failureCallback);
	};
		
};