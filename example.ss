()

; xyz = x + y * z 
; x = 10 
; y = 20 
; z = 30

; double = x -> x * 2

; is-zero = 
    | 0 -> #true ()
    | _ -> #false ()

; person =
    { name = "John"
    , age = 30
    , address =
      { street = "123 Main St"
      , city = "Anytown"
      , country = "USA"
      }
    }

; numbers = 
    [1, 2, 3, 4, 5]
    |> list/map (x -> x * 2)
    |> list/map (x -> x + 1)

; sum = list/fold 0 (+) numbers 

; factorial =
    | n ? n < 0 -> #error "negative input"
    | 0 -> #ok 1
    | n -> #ok (n * compute (n - 1))

; compose = f -> g -> x -> f (g x)