use warp::Filter;

#[tokio::main]
async fn main() {
    let filter =
        warp::path!("view" / String / String)
        .map(|dir, file| format!("converted/{dir}/{file}"));
    warp::serve(filter)
        .run(([127, 0, 0, 1], 7404))
        .await;
}
