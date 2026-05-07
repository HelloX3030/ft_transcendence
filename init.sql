CREATE TYPE language_type AS ENUM ('de', 'en', 'esp');
CREATE TYPE user_role_type AS ENUM ('admin', 'user');
CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE role_type AS ENUM ( 'owner', 'editor', 'viewer');


CREATE TABLE users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username varchar(32) NOT NULL UNIQUE,
  password varchar(512) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  image varchar(255),
  language language_type NOT NULL,
  role user_role_type NOT NULL,
  created_at TIMESTAMP DEFAULT timezone('utc', now())
);


CREATE TABLE friends (
  user_a_id INT REFERENCES users(id),
  user_b_id INT REFERENCES users(id),
  status friend_status NOT NULL,
  created_at TIMESTAMP DEFAULT timezone('utc', now()),
  CONSTRAINT check_user_order CHECK (user_a_id < user_b_id),
  PRIMARY KEY (user_a_id, user_b_id)
);


CREATE TABLE movies (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tmdb_id integer NOT NULL UNIQUE,
  name varchar(255) NOT NULL
);


CREATE TABLE watchlists (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(255) NOT NULL,
  image varchar(255),
  created_at TIMESTAMP DEFAULT timezone('utc', now())
);


CREATE TABLE ratings (
  user_id INT REFERENCES users(id),
  movie_id INT REFERENCES movies(id),
  trailer_like bool NOT NULL,
  movie_rating smallint DEFAULT -1,
  created_at TIMESTAMP DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, movie_id)
);

CREATE TABLE watchlist_users (
  watchlist_id INT REFERENCES watchlists(id),
  user_id INT REFERENCES users(id),
  role role_type NOT NULL,
  PRIMARY KEY (watchlist_id, user_id)
);

CREATE TABLE watchlist_movies (
  watchlist_id INT REFERENCES watchlists(id),
  movie_id INT REFERENCES movies(id),
  PRIMARY KEY (watchlist_id, movie_id)
);


-- CREATE INDEX idx_ratings_user ON ratings(user_id);
-- CREATE INDEX idx_ratings_movie ON ratings(movie_id);

-- CREATE INDEX idx_watchlist_users_user ON watchlist_users(user_id);
-- CREATE INDEX idx_watchlist_movies_movie ON watchlist_movies(movie_id);

-- CREATE INDEX idx_friends_status ON friends(status);
