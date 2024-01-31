use std::fs;

use urlencoding::decode;
use warp::{Filter, path};

#[derive(Debug, Clone)]
struct PathPart(String);

#[derive(Debug, Clone)]
enum PathPartDecodeError {
    BadPercentEncoding(std::string::FromUtf8Error),
    CannotBox(<String as std::str::FromStr>::Err),
    LfiDetected,
}

impl std::str::FromStr for PathPart {
    type Err = PathPartDecodeError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let decoded = decode(s)
            .map_err(PathPartDecodeError::BadPercentEncoding)?;
        if decoded.contains("..") {
            return Err(PathPartDecodeError::LfiDetected)
        }
        Ok(
            Self(
                String::from_str(&decoded)
                    .map_err(PathPartDecodeError::CannotBox)?
            )
        )
    }
}

#[tokio::main]
async fn main() {
    let filter =
        path!("view" / PathPart / PathPart)
        .map(|dir: PathPart, name: PathPart| {
            fs::read_to_string(format!("converted/{}/{}", dir.0, name.0))
                .map(|body| warp::reply::with_status(
                    body,
                    warp::http::StatusCode::OK
                ))
                .unwrap_or(warp::reply::with_status(
                    "Page not found :(".to_owned(),
                    warp::http::StatusCode::NOT_FOUND
                ))
        });
    warp::serve(filter)
        .run(([127, 0, 0, 1], 7404))
        .await;
}
