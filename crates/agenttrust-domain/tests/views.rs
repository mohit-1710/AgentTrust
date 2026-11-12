use agenttrust_domain::{types::U64String, views::page_indices};
#[test]
fn pages_are_bounded_and_recent_cursor_survives_new_appends() {
    let first = page_indices(25, None, 20, true).unwrap();
    assert_eq!(
        (first.start, first.end, first.next_cursor),
        (5, 25, Some(U64String(5)))
    );
    let next = page_indices(28, first.next_cursor, 20, true).unwrap();
    assert_eq!((next.start, next.end, next.next_cursor), (0, 5, None));
    let forward = page_indices(25, None, 20, false).unwrap();
    assert_eq!(
        (forward.start, forward.end, forward.next_cursor),
        (0, 20, Some(U64String(20)))
    );
    let last = page_indices(25, forward.next_cursor, 20, false).unwrap();
    assert_eq!((last.start, last.end, last.next_cursor), (20, 25, None));
    assert_eq!(page_indices(0, None, 20, true).unwrap().end, 0);
}
#[test]
fn invalid_limits_and_out_of_range_cursors_reject() {
    for limit in [0, 21, u32::MAX] {
        assert_eq!(
            page_indices(25, None, limit, false),
            Err("INVALID_PAGE_LIMIT")
        );
    }
    for reverse in [true, false] {
        for cursor in [26, u64::MAX] {
            assert_eq!(
                page_indices(25, Some(U64String(cursor)), 20, reverse),
                Err("INVALID_CURSOR")
            );
        }
    }
}
