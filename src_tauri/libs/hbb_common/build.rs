
use protobuf::descriptor::field_descriptor_proto::Type;
use protobuf::reflect::FieldDescriptor;
use protobuf::reflect::MessageDescriptor;

use protobuf_codegen::Customize;
use protobuf_codegen::CustomizeCallback;

fn main() {
    struct GenSerde;

    impl CustomizeCallback for GenSerde {
        fn message(&self, _message: &MessageDescriptor) -> Customize {
            // println!("cargo:warning={:#?} {}", _message.proto().name(), _message.full_name());
            // DisplayInfo
            if _message.proto().name() == "DisplayInfo" {
                return Customize::default().before("#[derive(::serde::Serialize, ::serde::Deserialize)]")
            }
            else {
                Customize::default()
            }
        }

        fn field(&self, field: &FieldDescriptor) -> Customize {
            if field.proto().name() == "DisplayInfo" {
                // println!("cargo:warning={:#?} {} {}", field.proto().type_(), field.proto().name(), field.full_name());
                if field.proto().type_() == Type::TYPE_ENUM {
                    // `EnumOrUnknown` is not a part of rust-protobuf, so external serializer is needed.
                    Customize::default().before(
                        "#[serde(serialize_with = \"crate::proto_serde::serialize_enum_or_unknown\", deserialize_with = \"crate::proto_serde::deserialize_enum_or_unknown\")]")
                } else if field.proto().type_() == Type::TYPE_MESSAGE
                    && !field.is_repeated_or_map()
                {
                    Customize::default().before(
                        "#[serde(serialize_with = \"crate::proto_serde::serialize_message_field\", deserialize_with = \"crate::proto_serde::deserialize_message_field\")]")
                } else {
                    Customize::default()
                }
            } else {
                Customize::default()
            }
        }

        fn special_field(&self, _message: &MessageDescriptor, _field: &str) -> Customize {
            if _message.proto().name() == "DisplayInfo" {
                Customize::default().before("#[serde(skip)]")
            }
            else {
                Customize::default()
            }
        }
    }

    std::fs::create_dir_all("src/protos").unwrap();
    protobuf_codegen::Codegen::new()
        .pure()
        .out_dir("src/protos")
        .inputs(&["protos/rendezvous.proto", "protos/message.proto"])
        .include("protos")
        .customize(
            protobuf_codegen::Customize::default()
            .tokio_bytes(true)
        )
        .customize_callback(GenSerde)
        .run()
        .expect("Codegen failed.");
}
