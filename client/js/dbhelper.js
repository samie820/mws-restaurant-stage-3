/**
 * Common database helper functions.
 */
class DBHelper {
  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  static get CREATE_REVIEW_URL() {
    const port = 1337;
    return `http://localhost:${port}/reviews`;
  }

  static get RESTAURANT_REVIEWS() {
    const port = 1337;
    return `http://localhost:${port}/reviews/?restaurant_id=`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    const appOnline = window.navigator.onLine;
    if (appOnline) {
      DBHelper.fetchRestaurantsFromServer(callback);
    } else {
      DBHelper.getRestaurantsFromDB(callback);
    }
  }

  /**
   * Fetch all restaurants reviews.
   */
  static fetchRestaurantReviews(callback, id) {
    const appOnline = window.navigator.onLine;
    if (appOnline) {
      DBHelper.fetchRestaurantsReviewFromServer(callback, id);
      DBHelper.syncRestaurantsReviewWithServer();
    } else {
      DBHelper.getRestaurantReviewsFromDB(callback, id);
    }
  }

  /**
   * Sync saved payload to the server
   *
   */
  static syncRestaurantsReviewWithServer() {
    const dbPromise = idb.open("restaurantDatabase");
    dbPromise
      .then(function(db) {
        const tx = db.transaction("reviews");
        const reviewsStore = tx.objectStore("reviews");
        return reviewsStore.getAll();
      })
      .then(function(reviews) {
        // send payload to the server
        reviews.forEach(offlineReview => {
          if (offlineReview.offline) {
            const payload = {
              comments: offlineReview.comments,
              name: offlineReview.name,
              rating: offlineReview.rating,
              restaurant_id: offlineReview.restaurant_id
            };
            fetch(DBHelper.CREATE_REVIEW_URL, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
              },
              body: JSON.stringify(payload)
            })
              .then(res => res.json())
              .then(response => {
                dbPromise.then(db => {
                  // delete offline data after sending it to the server
                  const tx = db.transaction("reviews", "readwrite");
                  const reviewsStore = tx.objectStore("reviews");
                  reviewsStore.delete(offlineReview.id);
                  reviewsStore.put(response);
                  return tx.complete;
                });
              }) // Got a successfully response from the server
              .catch(errorMessage => {
                const error = `Request failed. Returned status of ${errorMessage}`;
                console.log(error);
              });
          }
        });
      });
  }

  /**
   * Retrieve response from the database
   *
   */
  static getRestaurantReviewsFromDB(callback, id) {
    const dbPromise = idb.open("restaurantDatabase");
    dbPromise
      .then(function(db) {
        const tx = db.transaction("reviews");
        const reviewsStore = tx.objectStore("reviews");
        return reviewsStore.getAll();
      })
      .then(function(reviews) {
        callback(
          null,
          reviews.filter(
            review => review.restaurant_id.toString() === id.toString()
          )
        );
      })
      .catch(function(error) {
        const error = `Request failed. Returned status of ${error}`;
        callback(error, null);
      });
  }

  /**
   * Post a Restaurant Review to the server
   */
  static saveRestaurantReview(payload, callback) {
    const appOnline = window.navigator.onLine;
    if (appOnline) {
      DBHelper.saveRestaurantReviewToServer(callback, payload);
    } else {
      DBHelper.saveReviewToDB(payload, null, true);
      callback(
        "You device appears to be offline, Your review will be sent to the server when you come back online",
        null
      );
    }
  }

  /**
   * save new restaurant review to the server.
   */
  static saveRestaurantReviewToServer(callback, payload) {
    fetch(DBHelper.CREATE_REVIEW_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(response => {
        DBHelper.saveReviewToDB(response, callback, false); // save to IndexedDB
      }) // Got a successfully response from the server
      .catch(errorMessage => {
        const error = `Request failed. Returned status of ${errorMessage}`;
        callback(error, null);
      });
  }

  /**
   * Save restaurant review to the database
   * @param {Object} review
   */
  static saveReviewToDB(review, callback, isOffline) {
    const dbPromise = idb.open("restaurantDatabase", 1, function(upgradeDB) {
      upgradeDB.createObjectStore("restaurants", { keyPath: "id" });
      upgradeDB.createObjectStore("reviews", { keyPath: "id" });
    });
    if (isOffline) {
      dbPromise.then(function(db) {
        const tx = db.transaction("reviews", "readwrite");
        const reviewStore = tx.objectStore("reviews");
        // save the recieved review to the DB
        review.offline = true;
        review.id = Math.floor(Math.random() * 100),
        reviewStore.put(review);
        return tx.complete;
      });
    }
    dbPromise.then(function(db) {
      const tx = db.transaction("reviews", "readwrite");
      const reviewStore = tx.objectStore("reviews");
      // save the recieved review to the DB
      reviewStore.put(review);
      return tx.complete.then(() => {
        callback(null, review);
      });
    });
  }

  /**
   * Fetch all restaurants from the server.
   */
  static fetchRestaurantsFromServer(callback) {
    fetch(DBHelper.DATABASE_URL)
      .then(res => res.json())
      .then(response => {
        callback(null, response);
        DBHelper.saveRestaurantsToDB(response); // save to IndexedDB
      }) // Got a successfully response from the server
      .catch(errorMessage => {
        const error = `Request failed. Returned status of ${errorMessage}`;
        callback(error, null);
      });
  }

  /**
   * Fetch all restaurants review from the server.
   */
  static fetchRestaurantsReviewFromServer(callback, id) {
    fetch(`${DBHelper.RESTAURANT_REVIEWS}${id}`)
      .then(res => res.json())
      .then(response => {
        callback(null, response);
        DBHelper.saveRestaurantReviewsToDB(response); // save to IndexedDB
      }) // Got a successfully response from the server
      .catch(errorMessage => {
        const error = `Request failed. Returned status of ${errorMessage}`;
        callback(error, null);
      });
  }

  /**
   * Save response from the server to the database
   * @param {Object} restaurants
   */
  static saveRestaurantsToDB(restaurants) {
    const dbPromise = idb.open("restaurantDatabase", 1, function(upgradeDB) {
      upgradeDB.createObjectStore("restaurants", { keyPath: "id" });
      upgradeDB.createObjectStore("reviews", { keyPath: "id" });
    });
    dbPromise.then(function(db) {
      const tx = db.transaction("restaurants", "readwrite");
      const restaurantStore = tx.objectStore("restaurants");
      // save the recieved restaurants to the DB
      restaurants.forEach(function(restaurant) {
        restaurantStore.put(restaurant);
        return tx.complete;
      });
      return restaurantStore.getAll();
    });
  }

  /**
   * Save response from the server to the database
   * @param {Object} reviews
   */
  static saveRestaurantReviewsToDB(reviews) {
    const dbPromise = idb.open("restaurantDatabase", 1, function(upgradeDB) {
      upgradeDB.createObjectStore("restaurants", { keyPath: "id" });
      upgradeDB.createObjectStore("reviews", { keyPath: "id" });
    });
    dbPromise.then(function(db) {
      const tx = db.transaction("reviews", "readwrite");
      const reviewstore = tx.objectStore("reviews");
      // save the recieved reviews to the DB
      reviews.forEach(function(restaurant) {
        reviewstore.put(restaurant);
        return tx.complete;
      });
      return reviewstore.getAll();
    });
  }

  /**
   * Retrieve response from the database
   *
   */
  static getRestaurantsFromDB(callback) {
    const dbPromise = idb.open("restaurantDatabase");
    dbPromise
      .then(function(db) {
        const tx = db.transaction("restaurants");
        const restaurantStore = tx.objectStore("restaurants");
        return restaurantStore.getAll();
      })
      .then(function(restaurants) {
        callback(null, restaurants);
      })
      .catch(function(error) {
        const error = `Request failed. Returned status of ${error}`;
        callback(error, null);
      });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) {
          // Got the restaurant
          callback(null, restaurant);
        } else {
          // Restaurant does not exist in the database
          callback("Restaurant does not exist", null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    callback
  ) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != "all") {
          // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != "all") {
          // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map(
          (v, i) => restaurants[i].neighborhood
        );
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter(
          (v, i) => neighborhoods.indexOf(v) == i
        );
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter(
          (v, i) => cuisines.indexOf(v) == i
        );
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return `./restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    if (restaurant.photograph) {
      return `/img/${restaurant.photograph}.jpg`;
    }
    return "/img/10.jpg";
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker
    const marker = new L.marker(
      [restaurant.latlng.lat, restaurant.latlng.lng],
      {
        title: restaurant.name,
        alt: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant)
      }
    );
    marker.addTo(newMap);
    return marker;
  }
  /* static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  } */
}
